using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using Abp.Dependency;
using Abp.Domain.Repositories;
using IzinYonetimi.Entities;
using IzinYonetimi.Flows;

namespace IzinYonetimi.Approvals
{
    /// <summary>
    /// Onay adiminin onaycisini cozer. Donus: (userId, roleName) — biri dolu, ikisi de bossa cozulemedi.
    ///   - fixed: akis tanimina gomulu kullanici id
    ///   - role:  rol adi; roldeki herkes onaylayabilir
    ///   - field: tetikleyen veride (triggerData), yoksa entity'de ayni adli alan.
    ///            Deger sayiysa kullanici id, metinse rol adi kabul edilir.
    ///   - manager: kaydi olusturanin (CreatorUserId) org semasindaki yoneticisi, N seviye yukari.
    ///   - orgUnitHead: "requester" (talep edenin birimi), "requester+N" (N ust birim) ya da birim kodu.
    ///   - position: pozisyon kodu (orn. CFO) — o pozisyondaki calisan.
    ///   Org tiplerinde: kisi kendini onaylamaz (bir ust seviyeye gecilir); kimse bulunamazsa
    ///   hata yerine "Admin" rolune duser (bos pozisyon onay akisini kilitlemesin).
    ///   Kullanici ↔ calisan eslemesi e-posta ile. Bu projede org semasi yok → org tipleri Admin rolune duser.
    /// </summary>
    public class AssigneeResolver : ITransientDependency
    {
        private readonly IIocResolver _iocResolver;

        /// <summary>Org tiplerinde onayci bulunamazsa kaydin dustugu rol.</summary>
        public const string OrgFallbackRole = "Admin";
        // CSV'de dongulu yonetici/ust birim tanimi sonsuz donguye sokmasin
        private const int MaxHops = 25;

        public AssigneeResolver(IIocResolver iocResolver)
        {
            _iocResolver = iocResolver;
        }

        /// <summary>Adim kosulu: alan once triggerData'da, yoksa entity'de aranir. Kosul yoksa true.</summary>
        /// <summary>Kaydi olusturan kullanici (talep sahibi); bulunamazsa null</summary>
        public async Task<long?> GetCreatorUserIdAsync(string entityType, string entityId)
            => long.TryParse(Invariant(GetProperty(await LoadEntityAsync(entityType, entityId), "CreatorUserId")), out var id) ? id : (long?)null;

        public async Task<bool> StepAppliesAsync(FlowApprovalStep step, string entityType, string entityId,
            IDictionary<string, object> triggerData = null)
        {
            if (step?.Condition?.Rules == null || step.Condition.Rules.Count == 0) return true;
            var entity = await LoadEntityAsync(entityType, entityId);
            return ConditionEvaluator.Evaluate(step.Condition, field =>
                Invariant(FromTriggerData(triggerData, field) ?? GetProperty(entity, field)));
        }

        public async Task<(long userId, string roleName)> ResolveAsync(
            FlowApprovalStep step, string entityType, string entityId,
            IDictionary<string, object> triggerData = null)
        {
            var resolved = await ResolveCoreAsync(step, entityType, entityId, triggerData);
            return resolved;
        }

        private async Task<(long userId, string roleName)> ResolveCoreAsync(
            FlowApprovalStep step, string entityType, string entityId,
            IDictionary<string, object> triggerData)
        {
            if (step == null || string.IsNullOrWhiteSpace(step.AssigneeValue)) return (0, null);

            switch (step.AssigneeType)
            {
                case "fixed":
                    return long.TryParse(step.AssigneeValue, out var fixedId) ? (fixedId, null) : (0, null);
                case "role":
                    return (0, step.AssigneeValue);
                case "field":
                    var fromTrigger = FromTriggerData(triggerData, step.AssigneeValue);
                    if (fromTrigger != null) return Interpret(fromTrigger);
                    return Interpret(GetProperty(await LoadEntityAsync(entityType, entityId), step.AssigneeValue));
                case "manager":
                case "orgUnitHead":
                case "position":
                    return (0, OrgFallbackRole);
                default:
                    return (0, null);
            }
        }

        private static string Invariant(object value) =>
            value == null ? null : Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture);

        private static (long userId, string roleName) Interpret(object raw)
        {
            var s = raw?.ToString();
            if (long.TryParse(s, out var id)) return (id, null);
            return string.IsNullOrWhiteSpace(s) ? (0, null) : (0, s);
        }

        private static object FromTriggerData(IDictionary<string, object> data, string key)
        {
            if (data == null) return null;
            var hit = data.Keys.FirstOrDefault(k => string.Equals(k, key, StringComparison.OrdinalIgnoreCase));
            return hit == null ? null : data[hit];
        }

        // IRepository<TEntity, long> reflection ile — resolver entity'den bagimsiz kalir.
        private async Task<object> LoadEntityAsync(string entityType, string entityIdStr)
        {
            if (!long.TryParse(entityIdStr, out var entityId)) return null;
            var entityClrType = ResolveEntityClrType(entityType);
            if (entityClrType == null) return null;

            var repoIface = typeof(IRepository<,>).MakeGenericType(entityClrType, typeof(long));
            using (var disposable = _iocResolver.ResolveAsDisposable(repoIface))
            {
                var repo = disposable.Object;
                var firstOrDefault = repo.GetType().GetMethod("FirstOrDefaultAsync", new[] { typeof(long) });
                if (firstOrDefault == null) return null;
                var task = (Task)firstOrDefault.Invoke(repo, new object[] { entityId });
                await task.ConfigureAwait(false);
                return task.GetType().GetProperty("Result")?.GetValue(task);
            }
        }

        private static object GetProperty(object entity, string propertyName) =>
            entity?.GetType().GetProperties()
                .FirstOrDefault(p => string.Equals(p.Name, propertyName, StringComparison.OrdinalIgnoreCase))
                ?.GetValue(entity);

        public static System.Type ResolveEntityClrType(string entityType)
        {
            var rootNs = typeof(AssigneeResolver).Namespace?.Split('.')[0] ?? "IzinYonetimi";
            return System.Type.GetType($"{rootNs}.Entities.{entityType}, {rootNs}.Core")
                ?? FindTypeByName(entityType, false);
        }

        // Yuklu assembly'lerde ada gore tip arar (namespace tahmini tutmadiginda yedek).
        // Sonuc onbellege alinir; GetTypes() her cagride pahalidir.
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, System.Type> _typeCache =
            new System.Collections.Concurrent.ConcurrentDictionary<string, System.Type>();

        public static System.Type FindTypeByName(string typeName, bool interfaceOnly)
        {
            return _typeCache.GetOrAdd($"{typeName}|{interfaceOnly}", _ =>
            {
                foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                {
                    if (asm.IsDynamic) continue;
                    System.Type[] types;
                    try { types = asm.GetTypes(); }
                    catch (ReflectionTypeLoadException ex) { types = ex.Types.Where(t => t != null).ToArray(); }
                    catch { continue; }

                    var hit = types.FirstOrDefault(t =>
                        t.Name == typeName && (!interfaceOnly || t.IsInterface));
                    if (hit != null) return hit;
                }
                return null;
            });
        }
    }
}
