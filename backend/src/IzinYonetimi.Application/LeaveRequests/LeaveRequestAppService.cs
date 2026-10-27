using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Abp.Domain.Repositories;
using Abp.Extensions;
using Abp.Linq.Extensions;
using IzinYonetimi.Entities;
using IzinYonetimi.LeaveRequests.Dto;
using IzinYonetimi.Analytics.Dto;
using IzinYonetimi.StateMachine.Dto;
using IzinYonetimi.Approvals.Dto;
using IzinYonetimi.Authorization;
using IzinYonetimi.Flows;

namespace IzinYonetimi.LeaveRequests
{
    [Abp.Authorization.AbpAuthorize]
    public class LeaveRequestAppService : AsyncCrudAppService<
        LeaveRequest,
        LeaveRequestDto,
        long,
        PagedLeaveRequestResultRequestDto,
        CreateLeaveRequestDto,
        LeaveRequestDto>,
        ILeaveRequestAppService
    {
        private readonly IRepository<StatusChangeLog, long> _statusChangeLogRepo;
        private readonly IRepository<ApprovalRecord, Guid> _approvalRepo;
        private readonly IFlowEngine _flowEngine;

        public LeaveRequestAppService(IRepository<LeaveRequest, long> repository, IFlowEngine flowEngine, IRepository<StatusChangeLog, long> statusChangeLogRepo, IRepository<ApprovalRecord, Guid> approvalRepo)
            : base(repository)
        {
            _flowEngine = flowEngine;
            _statusChangeLogRepo = statusChangeLogRepo;
            _approvalRepo = approvalRepo;
            // Claim-based authorization (JwtPermissionChecker reads JWT "permission" claims)
            GetPermissionName = PermissionNames.LeaveRequest_Read;
            GetAllPermissionName = PermissionNames.LeaveRequest_Read;
            CreatePermissionName = PermissionNames.LeaveRequest_Create;
            UpdatePermissionName = PermissionNames.LeaveRequest_Update;
            DeletePermissionName = PermissionNames.LeaveRequest_Delete;
        }

        protected override IQueryable<LeaveRequest> CreateFilteredQuery(PagedLeaveRequestResultRequestDto input)
        {
            return Repository.GetAllIncluding(x => x.User)
                .WhereIf(!input.Keyword.IsNullOrWhiteSpace(), x =>
                    x.Id.ToString().Contains(input.Keyword) ||
                    (x.Reason != null && x.Reason.Contains(input.Keyword)) ||
                    (x.DoctorReportNote != null && x.DoctorReportNote.Contains(input.Keyword)) ||
                    (x.RevisionNote != null && x.RevisionNote.Contains(input.Keyword)))
                .WhereIf(!input.Reason.IsNullOrWhiteSpace(), x => x.Reason != null && x.Reason.Contains(input.Reason))
                .WhereIf(!input.DoctorReportNote.IsNullOrWhiteSpace(), x => x.DoctorReportNote != null && x.DoctorReportNote.Contains(input.DoctorReportNote))
                .WhereIf(!input.RevisionNote.IsNullOrWhiteSpace(), x => x.RevisionNote != null && x.RevisionNote.Contains(input.RevisionNote))
                .WhereIf(input.LeaveType.HasValue, x => x.LeaveType == (LeaveRequestLeaveType)input.LeaveType.Value)
                .WhereIf(input.StartDate.HasValue, x => x.StartDate == input.StartDate.Value)
                .WhereIf(input.EndDate.HasValue, x => x.EndDate == input.EndDate.Value)
                .WhereIf(input.TotalDays.HasValue, x => x.TotalDays == input.TotalDays.Value)
                .WhereIf(input.Status.HasValue, x => x.Status == (LeaveRequestStatus)input.Status.Value)
                .WhereIf(input.ManagerId.HasValue, x => x.ManagerId == input.ManagerId.Value)
                .WhereIf(input.StartDateFrom.HasValue, x => x.StartDate >= input.StartDateFrom.Value)
                .WhereIf(input.StartDateTo.HasValue, x => x.StartDate <= input.StartDateTo.Value)
                .WhereIf(input.EndDateFrom.HasValue, x => x.EndDate >= input.EndDateFrom.Value)
                .WhereIf(input.EndDateTo.HasValue, x => x.EndDate <= input.EndDateTo.Value)
                .WhereIf(input.TotalDaysFrom.HasValue, x => x.TotalDays >= input.TotalDaysFrom.Value)
                .WhereIf(input.TotalDaysTo.HasValue, x => x.TotalDays <= input.TotalDaysTo.Value)
                .WhereIf(input.ManagerIdFrom.HasValue, x => x.ManagerId >= input.ManagerIdFrom.Value)
                .WhereIf(input.ManagerIdTo.HasValue, x => x.ManagerId <= input.ManagerIdTo.Value)
                .WhereIf(!input.LeaveTypeIn.IsNullOrWhiteSpace(), x => input.LeaveTypeIn
                    .Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(v => (LeaveRequestLeaveType?)int.Parse(v.Trim()))
                    .Contains(x.LeaveType))
                .WhereIf(input.LeaveTypeNot.HasValue, x => x.LeaveType != (LeaveRequestLeaveType)input.LeaveTypeNot.Value)
                .WhereIf(!input.StatusIn.IsNullOrWhiteSpace(), x => input.StatusIn
                    .Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(v => (LeaveRequestStatus?)int.Parse(v.Trim()))
                    .Contains(x.Status))
                .WhereIf(input.StatusNot.HasValue, x => x.Status != (LeaveRequestStatus)input.StatusNot.Value)
                .WhereIf(input.UserId.HasValue, x => x.UserId == input.UserId.Value);
        }

        public override async Task<LeaveRequestDto> CreateAsync(CreateLeaveRequestDto input)
        {
            // Durum is akisina ait: yeni kayit her zaman baslangic durumunda acilir (gonderme ChangeStatus ile)
            input.Status = (int)LeaveRequestStatus.Draft;
            var result = await base.CreateAsync(input);
            await _flowEngine.TriggerAsync("on-create", "LeaveRequest", result);
            return result;
        }

        public override async Task<LeaveRequestDto> UpdateAsync(LeaveRequestDto input)
        {
            var existing = await Repository.GetAsync(input.Id);
            if (new[] { "PendingHRApproval", "PendingManagerApproval", "Approved" }.Contains(existing.Status.ToString()))
                throw new Abp.UI.UserFriendlyException("Bu kayıt onay sürecinde ya da onaylanmış; düzenlenemez.");
            if ((int)existing.Status != input.Status)
                throw new Abp.UI.UserFriendlyException("Durum yalnızca iş akışı eylemleriyle değiştirilebilir.");
            var result = await base.UpdateAsync(input);
            await _flowEngine.TriggerAsync("on-update", "LeaveRequest", result);
            return result;
        }

        public override async Task DeleteAsync(EntityDto<long> input)
        {
            var existing = await Repository.GetAsync(input.Id);
            if (new[] { "PendingHRApproval", "PendingManagerApproval", "Approved" }.Contains(existing.Status.ToString()))
                throw new Abp.UI.UserFriendlyException("Bu kayıt onay sürecinde ya da onaylanmış; silinemez.");
            await base.DeleteAsync(input);
            await _flowEngine.TriggerAsync("on-delete", "LeaveRequest", new { Id = input.Id });
        }

        // Onay adimini tamamlayan rol genelde Update degil ChangeStatus yetkisine sahip olur;
        // RequireAllPermissions=false ile ikisinden biri yeterli (geriye donuk uyumlu).
        [Abp.Authorization.AbpAuthorize(PermissionNames.LeaveRequest_ChangeStatus, PermissionNames.LeaveRequest_Update, RequireAllPermissions = false)]
        public async Task<LeaveRequestDto> ChangeStatusAsync(long id, ChangeStatusInput input)
        {
            // Onay adimlari yalniz atanmis onayci tarafindan, onay servisi uzerinden ilerletilir
            if (input.Action == "Approve")
                throw new Abp.UI.UserFriendlyException("Onay adımları yalnızca onay ekranından ilerletilebilir.");
            // Onay bekleyen kayitta karar (Reject/Revise...) yalniz atanmis onaycinin onay ekranindan verilir; talep sahibi yalniz iptal edebilir
            var current = (await Repository.GetAsync(id)).Status.ToString();
            if (new[] { "PendingHRApproval", "PendingManagerApproval" }.Contains(current) && input.Action != "Cancel")
                throw new Abp.UI.UserFriendlyException("Onay bekleyen kayıtta karar yalnızca onay ekranından verilir.");
            return await ApplyStatusChangeAsync(id, input);
        }

        // ABP dinamik API'si attribute'u implementasyonda arar (arayuzdeki yetmez)
        [Abp.Application.Services.RemoteService(false)]
        public async Task<LeaveRequestDto> ApplyApprovalTransitionAsync(long id, ChangeStatusInput input)
        {
            // Onay ekranindaki ret karari: bu durumdan Revise yoksa Reject'e (ya da tersi) duser
            if (input.Action == "Revise" || input.Action == "Reject")
            {
                var current = (await Repository.GetAsync(id)).Status.ToString();
                bool Has(string a) => Transitions.Any(t => (t.From == "*" || t.From == current) && t.Action == a);
                var alt = input.Action == "Revise" ? "Reject" : "Revise";
                if (!Has(input.Action) && Has(alt)) input.Action = alt;
            }
            return await ApplyStatusChangeAsync(id, input);
        }

        private static readonly (string From, string To, string Action, bool Readonly)[] Transitions = new (string From, string To, string Action, bool Readonly)[]
        {
            ("Draft", "PendingHRApproval", "Submit", false),
            ("PendingHRApproval", "PendingManagerApproval", "Approve", false),
            ("PendingHRApproval", "Revision", "Revise", false),
            ("PendingManagerApproval", "Approved", "Approve", false),
            ("PendingManagerApproval", "Revision", "Revise", false),
            ("Revision", "PendingHRApproval", "Resubmit", false),
            ("*", "Cancelled", "Cancel", false)
        };

        private async Task<LeaveRequestDto> ApplyStatusChangeAsync(long id, ChangeStatusInput input)
        {
            var entity = await Repository.GetAsync(id);
            var currentStatus = entity.Status.ToString();

            var transition = Transitions.FirstOrDefault(t =>
                (t.From == "*" || t.From == currentStatus) && t.Action == input.Action);

            if (transition == default)
                throw new Abp.UI.UserFriendlyException($"Invalid action '{input.Action}' from status '{currentStatus}'");

            // Onay ekranindan gelen serbest metni gecisin zorunlu alanlarina tasi
            if (input.ActionData == null) input.ActionData = new Dictionary<string, string>();
            var genericNote = input.ActionData.ContainsKey("comment") && !string.IsNullOrWhiteSpace(input.ActionData["comment"])
                ? input.ActionData["comment"]
                : (input.ActionData.ContainsKey("revisionNote") ? input.ActionData["revisionNote"] : null);
            if (!string.IsNullOrWhiteSpace(genericNote))
            {
                foreach (var rf in new[] { "revisionNote" })
                {
                    if (!input.ActionData.ContainsKey(rf) || string.IsNullOrWhiteSpace(input.ActionData[rf]))
                        input.ActionData[rf] = genericNote;
                }
            }
            // Validate required fields per transition
            if (input.Action == "Revise" && (input.ActionData == null || !input.ActionData.ContainsKey("revisionNote") || string.IsNullOrWhiteSpace(input.ActionData["revisionNote"])))
                throw new Abp.UI.UserFriendlyException("Revise requires: revisionNote");
            // Bu gecisler icin bagli kayit on kosulu yok

            var fromStatus = currentStatus;

            // Apply new status
            entity.Status = (LeaveRequestStatus)Enum.Parse(typeof(LeaveRequestStatus), transition.To);
            if (input.ActionData != null && input.ActionData.ContainsKey("revisionNote") && !string.IsNullOrWhiteSpace(input.ActionData["revisionNote"]))
                entity.RevisionNote = input.ActionData["revisionNote"];

            await Repository.UpdateAsync(entity);
            await CurrentUnitOfWork.SaveChangesAsync();

            // Cancel pending ApprovalRecords when the entity is cancelled — otherwise the records
            // sit forever in approvers' inboxes pointing to a cancelled request.
            if (input.Action == "Cancel")
            {
                var pending = _approvalRepo.GetAll()
                    .Where(a => a.EntityType == "LeaveRequest" && a.EntityId == id.ToString() && a.Status == "Pending")
                    .ToList();
                foreach (var pendingRec in pending)
                {
                    pendingRec.Status = "Cancelled";
                    pendingRec.ActionTaken = "Cancel";
                    pendingRec.ActionDate = DateTime.UtcNow;
                    pendingRec.Comment = "Entity cancelled by submitter.";
                    await _approvalRepo.UpdateAsync(pendingRec);
                }
            }

            // Log status change
            await _statusChangeLogRepo.InsertAsync(new Entities.StatusChangeLog
            {
                EntityType = "LeaveRequest",
                EntityId = id.ToString(),
                FromStatus = fromStatus,
                ToStatus = transition.To,
                Action = input.Action,
                Comment = input.ActionData != null && input.ActionData.ContainsKey("comment") ? input.ActionData["comment"] : null,
                ChangedByUserId = AbpSession.UserId
            });

            var result = MapToEntityDto(entity);

            // Trigger flow: on-status-change (always)
            await _flowEngine.TriggerAsync("on-field-change", "LeaveRequest", result);

            // Trigger named flow events
            if (input.Action == "Submit")
                await _flowEngine.TriggerAsync("submit-for-approval", "LeaveRequest", result);
            return result;
        }


        [Abp.Authorization.AbpAuthorize(PermissionNames.LeaveRequest_Read)]
        public List<GroupCountDto> GetGroupedCount(LeaveRequestGroupedCountInput input)
        {
            // Whitelist — istemciden gelen alan adı doğrudan sorguya girmez.
            var allowed = new[] { "LeaveType", "Status", "UserId" };
            if (input.GroupBy == null || !allowed.Contains(input.GroupBy))
            {
                throw new Abp.UI.UserFriendlyException(
                    $"Gruplanabilir alan degil: {input.GroupBy}. Izin verilenler: {string.Join(", ", allowed)}");
            }

            var query = CreateFilteredQuery(input);

            switch (input.GroupBy)
            {
                case "LeaveType":
                    return query
                        .GroupBy(x => x.LeaveType)
                        .Select(g => new GroupCountDto
                        {
                            Key = ((int)g.Key).ToString(),
                            Label = g.Key.ToString(),
                            Count = g.Count(),
                        })
                        .ToList();
                case "Status":
                    return query
                        .GroupBy(x => x.Status)
                        .Select(g => new GroupCountDto
                        {
                            Key = ((int)g.Key).ToString(),
                            Label = g.Key.ToString(),
                            Count = g.Count(),
                        })
                        .ToList();
                case "UserId":
                    return query
                        .GroupBy(x => new { Key = x.UserId, Label = x.User == null ? null : x.User.Name })
                        .Select(g => new GroupCountDto
                        {
                            Key = g.Key.Key.ToString(),
                            Label = g.Key.Label ?? "(bos)",
                            Count = g.Count(),
                        })
                        .ToList();
                default:
                    return new List<GroupCountDto>();
            }
        }

        [Abp.Authorization.AbpAuthorize(PermissionNames.LeaveRequest_Read)]
        public decimal? GetStats(LeaveRequestStatsInput input)
        {
            var query = CreateFilteredQuery(input);

            if (input.Aggregate == "avgDayDiff")
            {
                var allowedDates = new[] { "StartDate", "EndDate" };
                if (!allowedDates.Contains(input.FromField) || !allowedDates.Contains(input.ToField))
                {
                    throw new Abp.UI.UserFriendlyException("avgDayDiff icin gecerli iki tarih alani gerekli.");
                }
                switch (input.FromField + "|" + input.ToField)
                {
                    case "StartDate|EndDate":
                    {
                        var pairsStartDateEndDate = query
                            .Select(x => new { A = x.StartDate, B = x.EndDate })
                            .ToList();
                        if (pairsStartDateEndDate.Count == 0) return null;
                        return (decimal)pairsStartDateEndDate.Average(p => (p.B - p.A).TotalDays);
                    }
                    case "EndDate|StartDate":
                    {
                        var pairsEndDateStartDate = query
                            .Select(x => new { A = x.EndDate, B = x.StartDate })
                            .ToList();
                        if (pairsEndDateStartDate.Count == 0) return null;
                        return (decimal)pairsEndDateStartDate.Average(p => (p.B - p.A).TotalDays);
                    }
                    default: return null;
                }
            }

            var allowedNumeric = new[] { "TotalDays", "ManagerId" };
            if (!allowedNumeric.Contains(input.Field))
            {
                throw new Abp.UI.UserFriendlyException(
                    $"Toplanabilir alan degil: {input.Field}. Izin verilenler: {string.Join(", ", allowedNumeric)}");
            }
            switch (input.Field)
            {
                        case "TotalDays": return input.Aggregate == "sum" ? query.Sum(x => (decimal?)x.TotalDays)
                            : input.Aggregate == "min" ? query.Min(x => (decimal?)x.TotalDays)
                            : input.Aggregate == "max" ? query.Max(x => (decimal?)x.TotalDays)
                            : query.Average(x => (decimal?)x.TotalDays);
                        case "ManagerId": return input.Aggregate == "sum" ? query.Sum(x => (decimal?)x.ManagerId)
                            : input.Aggregate == "min" ? query.Min(x => (decimal?)x.ManagerId)
                            : input.Aggregate == "max" ? query.Max(x => (decimal?)x.ManagerId)
                            : query.Average(x => (decimal?)x.ManagerId);
                        default: return null;
            }
        }

        /// <summary>
        /// Rapor verisi — kok kayit ve alt koleksiyonlar TEK yanitta.
        /// PDF sablonu template basina tek apiBinding kullaniyor.
        /// </summary>
        [Abp.Authorization.AbpAuthorize(PermissionNames.LeaveRequest_Read)]
        public async Task<LeaveRequestReportDto> GetReportData(long id)
        {
            var root = await Repository.GetAll()

                .FirstOrDefaultAsync(x => x.Id == id);

            if (root == null)
                throw new Abp.UI.UserFriendlyException($"Kayit bulunamadi: {id}");

            return new LeaveRequestReportDto
            {
                Data = ObjectMapper.Map<LeaveRequestDto>(root),

                // ApprovalRecord alan adlari: EntityType (isim) ve EntityId (STRING).
                // Once EntityName/long varsayilmisti — CS1061 + CS0019 veriyordu.
                ApprovalHistory = ObjectMapper.Map<List<ApprovalRecordDto>>(
                    _approvalRepo.GetAll()
                        .Where(a => a.EntityType == "LeaveRequest" && a.EntityId == id.ToString())
                        .OrderBy(a => a.StepIndex).ToList()),
            };
        }

    }
}
