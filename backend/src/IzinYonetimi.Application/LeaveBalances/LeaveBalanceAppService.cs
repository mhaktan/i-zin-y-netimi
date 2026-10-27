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
using IzinYonetimi.LeaveBalances.Dto;
using IzinYonetimi.Analytics.Dto;
using IzinYonetimi.Authorization;
using IzinYonetimi.Flows;

namespace IzinYonetimi.LeaveBalances
{
    [Abp.Authorization.AbpAuthorize]
    public class LeaveBalanceAppService : AsyncCrudAppService<
        LeaveBalance,
        LeaveBalanceDto,
        long,
        PagedLeaveBalanceResultRequestDto,
        CreateLeaveBalanceDto,
        LeaveBalanceDto>,
        ILeaveBalanceAppService
    {
        private readonly IFlowEngine _flowEngine;

        public LeaveBalanceAppService(IRepository<LeaveBalance, long> repository, IFlowEngine flowEngine)
            : base(repository)
        {
            _flowEngine = flowEngine;
            // Claim-based authorization (JwtPermissionChecker reads JWT "permission" claims)
            GetPermissionName = PermissionNames.LeaveBalance_Read;
            GetAllPermissionName = PermissionNames.LeaveBalance_Read;
            CreatePermissionName = PermissionNames.LeaveBalance_Create;
            UpdatePermissionName = PermissionNames.LeaveBalance_Update;
            DeletePermissionName = PermissionNames.LeaveBalance_Delete;
        }

        protected override IQueryable<LeaveBalance> CreateFilteredQuery(PagedLeaveBalanceResultRequestDto input)
        {
            return Repository.GetAllIncluding(x => x.User)
                .WhereIf(!input.Keyword.IsNullOrWhiteSpace(), x =>
                    x.Id.ToString().Contains(input.Keyword))
                .WhereIf(input.Year.HasValue, x => x.Year == input.Year.Value)
                .WhereIf(input.LeaveType.HasValue, x => x.LeaveType == (LeaveBalanceLeaveType)input.LeaveType.Value)
                .WhereIf(input.TotalEntitlement.HasValue, x => x.TotalEntitlement == input.TotalEntitlement.Value)
                .WhereIf(input.UsedDays.HasValue, x => x.UsedDays == input.UsedDays.Value)
                .WhereIf(input.RemainingDays.HasValue, x => x.RemainingDays == input.RemainingDays.Value)
                .WhereIf(input.YearFrom.HasValue, x => x.Year >= input.YearFrom.Value)
                .WhereIf(input.YearTo.HasValue, x => x.Year <= input.YearTo.Value)
                .WhereIf(input.TotalEntitlementFrom.HasValue, x => x.TotalEntitlement >= input.TotalEntitlementFrom.Value)
                .WhereIf(input.TotalEntitlementTo.HasValue, x => x.TotalEntitlement <= input.TotalEntitlementTo.Value)
                .WhereIf(input.UsedDaysFrom.HasValue, x => x.UsedDays >= input.UsedDaysFrom.Value)
                .WhereIf(input.UsedDaysTo.HasValue, x => x.UsedDays <= input.UsedDaysTo.Value)
                .WhereIf(input.RemainingDaysFrom.HasValue, x => x.RemainingDays >= input.RemainingDaysFrom.Value)
                .WhereIf(input.RemainingDaysTo.HasValue, x => x.RemainingDays <= input.RemainingDaysTo.Value)
                .WhereIf(!input.LeaveTypeIn.IsNullOrWhiteSpace(), x => input.LeaveTypeIn
                    .Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(v => (LeaveBalanceLeaveType?)int.Parse(v.Trim()))
                    .Contains(x.LeaveType))
                .WhereIf(input.LeaveTypeNot.HasValue, x => x.LeaveType != (LeaveBalanceLeaveType)input.LeaveTypeNot.Value)
                .WhereIf(input.UserId.HasValue, x => x.UserId == input.UserId.Value);
        }

        public override async Task<LeaveBalanceDto> CreateAsync(CreateLeaveBalanceDto input)
        {
            var result = await base.CreateAsync(input);
            await _flowEngine.TriggerAsync("on-create", "LeaveBalance", result);
            return result;
        }

        public override async Task<LeaveBalanceDto> UpdateAsync(LeaveBalanceDto input)
        {
            var result = await base.UpdateAsync(input);
            await _flowEngine.TriggerAsync("on-update", "LeaveBalance", result);
            return result;
        }

        public override async Task DeleteAsync(EntityDto<long> input)
        {
            await base.DeleteAsync(input);
            await _flowEngine.TriggerAsync("on-delete", "LeaveBalance", new { Id = input.Id });
        }
        [Abp.Authorization.AbpAuthorize(PermissionNames.LeaveBalance_Read)]
        public List<GroupCountDto> GetGroupedCount(LeaveBalanceGroupedCountInput input)
        {
            // Whitelist — istemciden gelen alan adı doğrudan sorguya girmez.
            var allowed = new[] { "LeaveType", "UserId" };
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

        [Abp.Authorization.AbpAuthorize(PermissionNames.LeaveBalance_Read)]
        public decimal? GetStats(LeaveBalanceStatsInput input)
        {
            var query = CreateFilteredQuery(input);

            if (input.Aggregate == "avgDayDiff")
            {
                var allowedDates = new string[0];
                if (!allowedDates.Contains(input.FromField) || !allowedDates.Contains(input.ToField))
                {
                    throw new Abp.UI.UserFriendlyException("avgDayDiff icin gecerli iki tarih alani gerekli.");
                }
                switch (input.FromField + "|" + input.ToField)
                {
                    default: return null;
                }
            }

            var allowedNumeric = new[] { "Year", "TotalEntitlement", "UsedDays", "RemainingDays" };
            if (!allowedNumeric.Contains(input.Field))
            {
                throw new Abp.UI.UserFriendlyException(
                    $"Toplanabilir alan degil: {input.Field}. Izin verilenler: {string.Join(", ", allowedNumeric)}");
            }
            switch (input.Field)
            {
                        case "Year": return input.Aggregate == "sum" ? query.Sum(x => (decimal?)x.Year)
                            : input.Aggregate == "min" ? query.Min(x => (decimal?)x.Year)
                            : input.Aggregate == "max" ? query.Max(x => (decimal?)x.Year)
                            : query.Average(x => (decimal?)x.Year);
                        case "TotalEntitlement": return input.Aggregate == "sum" ? query.Sum(x => (decimal?)x.TotalEntitlement)
                            : input.Aggregate == "min" ? query.Min(x => (decimal?)x.TotalEntitlement)
                            : input.Aggregate == "max" ? query.Max(x => (decimal?)x.TotalEntitlement)
                            : query.Average(x => (decimal?)x.TotalEntitlement);
                        case "UsedDays": return input.Aggregate == "sum" ? query.Sum(x => (decimal?)x.UsedDays)
                            : input.Aggregate == "min" ? query.Min(x => (decimal?)x.UsedDays)
                            : input.Aggregate == "max" ? query.Max(x => (decimal?)x.UsedDays)
                            : query.Average(x => (decimal?)x.UsedDays);
                        case "RemainingDays": return input.Aggregate == "sum" ? query.Sum(x => (decimal?)x.RemainingDays)
                            : input.Aggregate == "min" ? query.Min(x => (decimal?)x.RemainingDays)
                            : input.Aggregate == "max" ? query.Max(x => (decimal?)x.RemainingDays)
                            : query.Average(x => (decimal?)x.RemainingDays);
                        default: return null;
            }
        }

    }
}
