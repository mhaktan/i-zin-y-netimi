using System;
using IzinYonetimi.Analytics.Dto;

namespace IzinYonetimi.LeaveRequests.Dto
{
    /// <summary>GetAll ile ayni filtreleri kabul eder, ustune GroupBy alir.</summary>
    public class LeaveRequestGroupedCountInput : PagedLeaveRequestResultRequestDto
    {
        public string GroupBy { get; set; }
    }

    public class LeaveRequestStatsInput : PagedLeaveRequestResultRequestDto
    {
        /// <summary>avg | sum | min | max | avgDayDiff</summary>
        public string Aggregate { get; set; }
        public string Field { get; set; }
        public string FromField { get; set; }
        public string ToField { get; set; }
    }
}
