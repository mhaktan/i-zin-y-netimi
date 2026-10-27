using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using Abp.Application.Services;
using Abp.Authorization;
using Abp.Dependency;
using Abp.Domain.Repositories;
using Abp.Net.Mail;
using Abp.Runtime.Session;
using Abp.UI;
using IzinYonetimi.Approvals.Dto;
using IzinYonetimi.Entities;
using IzinYonetimi.Flows;

namespace IzinYonetimi.Approvals
{
    public interface IApprovalAppService : IApplicationService
    {
        // Yalniz akis motoru (reflection) cagirir — REST'e acik olsaydi herkes onay iptal edip adim atlatabilirdi
        [Abp.Application.Services.RemoteService(false)]
        Task SubmitForApprovalAsync(SubmitApprovalInput input);
        Task<ApprovalRecordDto> ProcessApprovalAsync(ProcessApprovalInput input);
        Task<List<ApprovalRecordDto>> GetApprovalHistoryAsync(string entityType, string entityId);
        Task<List<StatusChangeLogDto>> GetStatusChangeLogsAsync(string entityType, string entityId);
        Task<List<PendingApprovalDto>> GetMyPendingApprovalsAsync();
    }

    // Entity-agnostik servis oldugu icin entity bazli permission verilemez; sinif duzeyinde
    // permission adi olmadan AbpAuthorize = "sadece authenticated kullanici" korumasi.
    // ProcessApprovalAsync ayrica kendi icinde assignee kontrolu yapar.
    [AbpAuthorize]
    public class ApprovalAppService : ApplicationService, IApprovalAppService
    {
        private readonly IRepository<ApprovalRecord, Guid> _approvalRepo;
        private readonly IRepository<StatusChangeLog, long> _statusChangeLogRepo;
        private readonly IRepository<AppUser, long> _userRepo;
        private readonly IRepository<AppRole, long> _roleRepo;
        private readonly IRepository<UserRole, long> _userRoleRepo;
        private readonly IEmailSender _emailSender;
        private readonly IFlowEngine _flowEngine;
        private readonly IIocResolver _iocResolver;
        private readonly AssigneeResolver _assigneeResolver;

        public ApprovalAppService(
            IRepository<ApprovalRecord, Guid> approvalRepo,
            IRepository<StatusChangeLog, long> statusChangeLogRepo,
            IRepository<AppUser, long> userRepo,
            IRepository<AppRole, long> roleRepo,
            IRepository<UserRole, long> userRoleRepo,
            IEmailSender emailSender,
            IFlowEngine flowEngine,
            IIocResolver iocResolver,
            AssigneeResolver assigneeResolver)
        {
            _approvalRepo = approvalRepo;
            _statusChangeLogRepo = statusChangeLogRepo;
            _userRepo = userRepo;
            _roleRepo = roleRepo;
            _userRoleRepo = userRoleRepo;
            _emailSender = emailSender;
            _flowEngine = flowEngine;
            _iocResolver = iocResolver;
            _assigneeResolver = assigneeResolver;
        }

        // Helper: returns user ids that belong to the named role (case-insensitive).
        private List<long> GetUserIdsInRole(string roleName)
        {
            if (string.IsNullOrEmpty(roleName)) return new List<long>();
            var role = _roleRepo.GetAll().FirstOrDefault(r => r.Name.ToLower() == roleName.ToLower());
            if (role == null) return new List<long>();
            return _userRoleRepo.GetAll().Where(ur => ur.RoleId == role.Id).Select(ur => ur.UserId).ToList();
        }

        // Helper: role names assigned to a user (used to expand "My Tasks" with role-broadcast records).
        /// <summary>
        /// Kullanicinin rol ADLARI. Navigation (ur.Role.Name) KULLANILMAZ: DbContext'te
        /// UserRole -> AppRole iliskisi eslenmemisse EF bos isim donduruyor ve rol bazli
        /// atanmis onaylar "My Tasks"ta hic gorunmuyor (sessiz hata, derleme kirilmiyor).
        /// Bunun yerine iki adimda, id uzerinden okunur.
        /// </summary>
        private List<string> GetUserRoleNames(long userId)
        {
            var roleIds = _userRoleRepo.GetAll()
                .Where(ur => ur.UserId == userId)
                .Select(ur => ur.RoleId)
                .ToList();
            if (roleIds.Count == 0) return new List<string>();

            return _roleRepo.GetAll()
                .Where(r => roleIds.Contains(r.Id))
                .Select(r => r.Name)
                .Where(n => n != null)
                .ToList();
        }

        [Abp.Application.Services.RemoteService(false)]
        public async Task SubmitForApprovalAsync(SubmitApprovalInput input)
        {
            // Cancel any existing pending approvals for this entity
            var existing = _approvalRepo.GetAll()
                .Where(a => a.EntityType == input.EntityType && a.EntityId == input.EntityId && a.Status == "Pending")
                .ToList();
            foreach (var record in existing)
            {
                record.Status = "Cancelled";
                await _approvalRepo.UpdateAsync(record);
            }

            // Kosulla atlanan her adim kendi "Approve" gecisini tuketir — adim ↔ Pending* durumu 1:1.
            // Atlanmazsa kayit atlanan adimin bekleme durumunda takili kalirdi.
            for (var i = 0; i < input.StepIndex; i++)
                await TryChangeEntityStatusAsync(input.EntityType, input.EntityId, "Approve", "Koşul sağlanmadı — onay adımı atlandı");
            if (input.NoApplicableStep) return;

            // Ilk adim tanimla geldiyse ayni resolver ile coz (sonraki adimlarla tek kural)
            if ((!input.AssigneeUserId.HasValue || input.AssigneeUserId.Value <= 0)
                && string.IsNullOrWhiteSpace(input.AssigneeRole)
                && !string.IsNullOrWhiteSpace(input.AssigneeType))
            {
                var step = new FlowApprovalStep { Name = input.StepName, AssigneeType = input.AssigneeType, AssigneeValue = input.AssigneeValue };
                var resolved = await _assigneeResolver.ResolveAsync(step, input.EntityType, input.EntityId, input.TriggerData);
                if (resolved.userId > 0) input.AssigneeUserId = resolved.userId;
                else input.AssigneeRole = resolved.roleName;
            }

            // Exactly one of AssigneeUserId / AssigneeRole must be set
            var hasUser = input.AssigneeUserId.HasValue && input.AssigneeUserId.Value > 0;
            var hasRole = !string.IsNullOrWhiteSpace(input.AssigneeRole);
            if (!hasUser && !hasRole)
                throw new UserFriendlyException(
                    $"Could not resolve assignee for step '{input.StepName}' (type={input.AssigneeType}, value={input.AssigneeValue}).");

            // Create first approval step
            var approvalRecord = new ApprovalRecord
            {
                EntityType = input.EntityType,
                EntityId = input.EntityId,
                FlowId = input.FlowId,
                NodeId = input.NodeId,
                StepIndex = input.StepIndex,
                StepName = string.IsNullOrEmpty(input.StepName) ? $"Step {input.StepIndex + 1}" : input.StepName,
                AssigneeUserId = hasUser ? input.AssigneeUserId : null,
                AssigneeRole = hasRole ? input.AssigneeRole : null,
                Status = "Pending"
            };

            await _approvalRepo.InsertAsync(approvalRecord);

            // Send notification email — failure here MUST NOT block record creation.
            // Role-based assignment fans the email out to every member of the role.
            if (!string.IsNullOrEmpty(input.EmailSubject))
            {
                var recipients = new List<AppUser>();
                try
                {
                    if (hasUser)
                    {
                        var u = await _userRepo.FirstOrDefaultAsync(input.AssigneeUserId.Value);
                        if (u != null) recipients.Add(u);
                    }
                    else if (hasRole)
                    {
                        var userIds = GetUserIdsInRole(input.AssigneeRole);
                        if (userIds.Count > 0)
                            recipients = _userRepo.GetAll().Where(u => userIds.Contains(u.Id)).ToList();
                    }

                    var body = string.IsNullOrEmpty(input.EmailBody)
                        ? $"<p>You have a pending approval: {input.EntityType} #{input.EntityId}</p>"
                        : input.EmailBody;

                    foreach (var r in recipients)
                    {
                        if (!string.IsNullOrEmpty(r.EmailAddress))
                            await _emailSender.SendAsync(r.EmailAddress, input.EmailSubject, body, true);
                    }
                }
                catch (Exception ex)
                {
                    Logger.Warn($"Approval notification email failed: {ex.Message}");
                }
            }
        }

        public async Task<ApprovalRecordDto> ProcessApprovalAsync(ProcessApprovalInput input)
        {
            var record = await _approvalRepo.GetAsync(input.ApprovalRecordId);

            if (record.Status != "Pending")
                throw new UserFriendlyException("Bu onay zaten işlenmiş.");

            // Authorization: caller must be the specifically assigned user OR a member of the
            // assigned role. Broadcast-style role assignments are first-to-act.
            var currentUserId = AbpSession.GetUserId();
            var canProcess = (record.AssigneeUserId.HasValue && record.AssigneeUserId.Value == currentUserId)
                             || (!string.IsNullOrEmpty(record.AssigneeRole)
                                 && GetUserRoleNames(currentUserId).Any(r => r.Equals(record.AssigneeRole, StringComparison.OrdinalIgnoreCase)));
            if (!canProcess)
                throw new UserFriendlyException("Bu onay adımı size atanmamış.");
            // Gorevler ayriligi: talep sahibi kendi talebine karar veremez (adim Admin'e dusmusse haric)
            if (!string.Equals(record.AssigneeRole, "Admin", StringComparison.OrdinalIgnoreCase)
                && await _assigneeResolver.GetCreatorUserIdAsync(record.EntityType, record.EntityId) == currentUserId)
                throw new UserFriendlyException("Kendi talebinize onay kararı veremezsiniz.");

            record.ActionTaken = input.Action;
            record.Comment = input.Comment;
            record.ActionDate = DateTime.UtcNow;

            // Look up the approval node config so we can drive next-step + assignee from the flow
            // definition rather than relying on the client to send NextAssigneeUserId.
            var flow = _flowEngine.GetFlowById(record.FlowId);
            // NodeId eskiden her uretimde degisiyordu; eski kayitlar hicbir dugume
            // denk gelmeyince adim listesi BOS okunuyor, onay "son adim" sanilip
            // kalan adimlar sessizce atlaniyordu. Bulunamazsa akisin onay dugumune dus.
            var node = flow?.Nodes?.FirstOrDefault(n => n.Id == record.NodeId)
                       ?? flow?.Nodes?.FirstOrDefault(n => n.Approval?.Steps != null && n.Approval.Steps.Any());
            if (node != null && node.Id != record.NodeId)
            {
                Logger.Warn($"ApprovalRecord {record.Id} NodeId '{record.NodeId}' bulunamadi; '{node.Id}' dugumune duseldi.");
                record.NodeId = node.Id;
            }
            var steps = node?.Approval?.Steps ?? new List<FlowApprovalStep>();
            if (steps.Count == 0)
                throw new UserFriendlyException("Approval steps could not be resolved for this record (flow definition missing).");

            // Ayni kayit icin baska bekleyen onay varsa (eski veri / es zamanli gonderim) karar verilmez
            if (_approvalRepo.GetAll().Any(a => a.Id != record.Id && a.EntityType == record.EntityType && a.EntityId == record.EntityId && a.Status == "Pending"))
                throw new UserFriendlyException("Bu kayıt için birden fazla bekleyen onay var; yöneticiye bildirin.");

            if (input.Action == "Approve")
            {
                var nextIdx = record.StepIndex + 1;
                // Kosulu saglanmayan sonraki adimlar atlanir; hic kalmazsa onay tamamlanir
                var skippedSteps = 0;
                while (nextIdx < steps.Count
                    && !await _assigneeResolver.StepAppliesAsync(steps[nextIdx], record.EntityType, record.EntityId))
                {
                    nextIdx++;
                    skippedSteps++;
                }
                var hasNextStep = nextIdx < steps.Count;

                FlowApprovalStep nextStep = null;
                long nextUserId = 0;
                string nextRole = null;

                if (hasNextStep)
                {
                    nextStep = steps[nextIdx];
                    var resolved = await _assigneeResolver.ResolveAsync(nextStep, record.EntityType, record.EntityId);
                    nextUserId = resolved.userId;
                    nextRole = resolved.roleName;
                    if (nextUserId <= 0 && string.IsNullOrEmpty(nextRole))
                        throw new UserFriendlyException(
                            $"Next step '{nextStep.Name}' assignee could not be resolved (assigneeType={nextStep.AssigneeType}, value={nextStep.AssigneeValue}).");

                    record.NextAssigneeUserId = nextUserId > 0 ? (long?)nextUserId : null;
                }

                record.Status = "Approved";
                await _approvalRepo.UpdateAsync(record);

                // Once ilerlet: entity'nin state machine'i (ChangeStatusAsync) gecis haritasinin sahibi.
                // Sonraki adimin kaydi ancak status degisimi basarili olduktan sonra acilir — aksi halde
                // status degisimi patlarsa onaycinin gelen kutusunda sahte bir "Pending" kayit kalabilir.
                await TryChangeEntityStatusAsync(record.EntityType, record.EntityId, "Approve", input.Comment);
                // Atlanan adimlarin durumlari da gecilir (adim ↔ Pending* durumu 1:1)
                for (var i = 0; i < skippedSteps; i++)
                    await TryChangeEntityStatusAsync(record.EntityType, record.EntityId, "Approve", "Koşul sağlanmadı — onay adımı atlandı");

                if (hasNextStep)
                {
                    await _approvalRepo.InsertAsync(new ApprovalRecord
                    {
                        EntityType = record.EntityType,
                        EntityId = record.EntityId,
                        FlowId = record.FlowId,
                        NodeId = record.NodeId,
                        StepIndex = nextIdx,
                        StepName = nextStep.Name ?? $"Step {nextIdx + 1}",
                        AssigneeUserId = nextUserId > 0 ? (long?)nextUserId : null,
                        AssigneeRole = !string.IsNullOrEmpty(nextRole) ? nextRole : null,
                        Status = "Pending"
                    });
                }
            }
            else if (input.Action == "Revise" || input.Action == "Reject")
            {
                record.Status = input.Action == "Reject" ? "Rejected" : "Revised";
                await _approvalRepo.UpdateAsync(record);

                // Hedef durum state machine'den gelir; surecte o durumdan Revise yoksa entity tarafi Reject'e duser (ve tersi)
                await TryChangeEntityStatusAsync(record.EntityType, record.EntityId, input.Action, input.Comment);
            }
            else
                throw new UserFriendlyException($"Geçersiz onay kararı: {input.Action}");

            return ObjectMapper.Map<ApprovalRecordDto>(record);
        }

        // Call I{EntityType}AppService.ApplyApprovalTransitionAsync(id, ChangeStatusInput) by reflection.
        // Approval-driven transitions piggy-back on the entity's existing transition map so we don't
        // duplicate state-machine logic in two places.
        private async Task TryChangeEntityStatusAsync(string entityType, string entityIdStr, string action, string comment)
        {
            if (!long.TryParse(entityIdStr, out var entityId))
                throw new UserFriendlyException($"Approval record has an unusable entity id '{entityIdStr}'.");
            try
            {
                var rootNs = GetType().Namespace?.Split('.')[0] ?? "IzinYonetimi";
                var pluralNs = $"{rootNs}.{entityType}s";
                var ifaceTypeName = $"{pluralNs}.I{entityType}AppService, {rootNs}.Application";
                // Once ad tahmini, tutmazsa yuklu assembly'lerde ara. Tek bir namespace/
                // cogul-ek tahminine bagli kalmak tum onay akisini sessizce durduruyordu.
                var iface = System.Type.GetType(ifaceTypeName) ?? AssigneeResolver.FindTypeByName($"I{entityType}AppService", true);
                if (iface == null)
                {
                    Logger.Error($"No app service interface for entity '{entityType}' (looked for {ifaceTypeName})");
                    throw new UserFriendlyException($"Status could not be updated: app service for '{entityType}' was not found.");
                }

                var method = iface.GetMethod("ApplyApprovalTransitionAsync");
                if (method == null)
                {
                    Logger.Error($"{iface.Name} has no ApplyApprovalTransitionAsync method.");
                    throw new UserFriendlyException($"Status could not be updated: '{entityType}' has no state machine.");
                }

                // ChangeStatusInput PAYLASILAN namespace'te ({ns}.StateMachine.Dto) uretiliyor.
                // Onceden entity bazli namespace'te aranıyordu; tip bulunamayinca bu metod
                // sessizce donuyor ve ONAY TAMAMLANSA BILE entity durumu ilerlemiyordu.
                // Eski projeler icin entity bazli ad da yedek olarak deneniyor.
                var changeStatusInputType =
                    System.Type.GetType($"{rootNs}.StateMachine.Dto.ChangeStatusInput, {rootNs}.Application")
                    ?? System.Type.GetType($"{pluralNs}.Dto.ChangeStatusInput, {rootNs}.Application")
                    ?? AssigneeResolver.FindTypeByName("ChangeStatusInput", false);
                if (changeStatusInputType == null)
                {
                    Logger.Error($"ChangeStatusInput type missing for '{entityType}'");
                    throw new UserFriendlyException("Status could not be updated: ChangeStatusInput type was not found.");
                }

                var changeInput = Activator.CreateInstance(changeStatusInputType);
                changeStatusInputType.GetProperty("Action")?.SetValue(changeInput, action);
                var actionData = new Dictionary<string, string>
                {
                    ["comment"] = comment ?? string.Empty,
                    ["revisionNote"] = comment ?? string.Empty,
                };
                changeStatusInputType.GetProperty("ActionData")?.SetValue(changeInput, actionData);

                using (var disposable = _iocResolver.ResolveAsDisposable(iface))
                {
                    var task = (Task)method.Invoke(disposable.Object, new[] { entityId, changeInput });
                    await task.ConfigureAwait(false);
                }
            }
            catch (TargetInvocationException tie)
            {
                Logger.Error($"ApplyApprovalTransitionAsync invoke failed for {entityType}#{entityIdStr}: {tie.InnerException?.Message}", tie.InnerException);
                if (tie.InnerException is UserFriendlyException ufe) throw ufe;
                throw new UserFriendlyException("Status update failed: " + (tie.InnerException?.Message ?? tie.Message));
            }
        }

        // Gecmis (yorumlar, kim onayladi) kaydin kendisi kadar hassas — o varligi okuma yetkisi sart.
        // Onceden giris yapmis herkes her kaydin onay yorumlarini okuyabiliyordu.
        private async Task EnsureCanReadEntityAsync(string entityType)
        {
            if (!await PermissionChecker.IsGrantedAsync($"{entityType}.Read"))
                throw new Abp.Authorization.AbpAuthorizationException($"{entityType}.Read yetkisi gerekli");
        }

        public async Task<List<ApprovalRecordDto>> GetApprovalHistoryAsync(string entityType, string entityId)
        {
            await EnsureCanReadEntityAsync(entityType);
            var records = _approvalRepo.GetAll()
                .Where(a => a.EntityType == entityType && a.EntityId == entityId)
                .OrderBy(a => a.CreationTime)
                .ToList();

            return ObjectMapper.Map<List<ApprovalRecordDto>>(records);
        }

        public async Task<List<StatusChangeLogDto>> GetStatusChangeLogsAsync(string entityType, string entityId)
        {
            await EnsureCanReadEntityAsync(entityType);
            var records = _statusChangeLogRepo.GetAll()
                .Where(r => r.EntityType == entityType && r.EntityId == entityId)
                .OrderBy(r => r.CreationTime)
                .ToList();

            return ObjectMapper.Map<List<StatusChangeLogDto>>(records);
        }

        public async Task<List<PendingApprovalDto>> GetMyPendingApprovalsAsync()
        {
            var userId = AbpSession.GetUserId();
            var userRoles = GetUserRoleNames(userId);
            // Pending = user is the named assignee OR the record is broadcast to a role this user belongs to.
            var records = _approvalRepo.GetAll()
                .Where(a => a.Status == "Pending"
                            && ((a.AssigneeUserId.HasValue && a.AssigneeUserId.Value == userId)
                                || (a.AssigneeRole != null && userRoles.Contains(a.AssigneeRole))))
                .OrderByDescending(a => a.CreationTime)
                .ToList();

            var result = new List<PendingApprovalDto>();
            foreach (var r in records)
            {
                // Ret butonu yalniz surecte bir ret/revize gecisi varsa (ApprovalDecisions codegen'de uretilir)
                var actions = new List<string> { "Approve" };
                if (ApprovalDecisions.RejectAction.TryGetValue(r.EntityType, out var rej) && !string.IsNullOrEmpty(rej)) actions.Add(rej);
                var creatorId = await _assigneeResolver.GetCreatorUserIdAsync(r.EntityType, r.EntityId);
                var creator = creatorId.HasValue ? _userRepo.GetAll().Where(u => u.Id == creatorId.Value).Select(u => (u.Name + " " + u.Surname).Trim()).FirstOrDefault() : null;
                result.Add(new PendingApprovalDto
                {
                    ApprovalRecordId = r.Id,
                    EntityType = r.EntityType,
                    EntityId = r.EntityId,
                    StepName = r.StepName,
                    CreationTime = r.CreationTime,
                    AvailableActions = actions,
                    CreatorName = creator,
                });
            }
            return result;
        }
    }
}
