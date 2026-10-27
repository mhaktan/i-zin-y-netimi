using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Abp.Application.Services;
using Abp.Application.Services.Dto;
using IzinYonetimi.Analytics.Dto;
using IzinYonetimi.LeaveBalances.Dto;

namespace IzinYonetimi.LeaveBalances
{
    public interface ILeaveBalanceAppService : IAsyncCrudAppService<
        LeaveBalanceDto,
        long,
        PagedLeaveBalanceResultRequestDto,
        CreateLeaveBalanceDto,
        LeaveBalanceDto>
    {
        List<GroupCountDto> GetGroupedCount(LeaveBalanceGroupedCountInput input);
        decimal? GetStats(LeaveBalanceStatsInput input);
    }
}
