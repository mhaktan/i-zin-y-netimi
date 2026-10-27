using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Abp.Application.Services;
using Abp.Application.Services.Dto;
using IzinYonetimi.Analytics.Dto;
using IzinYonetimi.StateMachine.Dto;
using IzinYonetimi.LeaveRequests.Dto;

namespace IzinYonetimi.LeaveRequests
{
    public interface ILeaveRequestAppService : IAsyncCrudAppService<
        LeaveRequestDto,
        long,
        PagedLeaveRequestResultRequestDto,
        CreateLeaveRequestDto,
        LeaveRequestDto>
    {
        Task<LeaveRequestDto> ChangeStatusAsync(long id, ChangeStatusInput input);

        // Yalniz ApprovalAppService cagirir — REST'e acik degil
        [Abp.Application.Services.RemoteService(false)]
        Task<LeaveRequestDto> ApplyApprovalTransitionAsync(long id, ChangeStatusInput input);
        List<GroupCountDto> GetGroupedCount(LeaveRequestGroupedCountInput input);
        decimal? GetStats(LeaveRequestStatsInput input);
        Task<LeaveRequestReportDto> GetReportData(long id);
    }
}
