using System;
using IzinYonetimi.Analytics.Dto;

namespace IzinYonetimi.LeaveBalances.Dto
{
    /// <summary>GetAll ile ayni filtreleri kabul eder, ustune GroupBy alir.</summary>
    public class LeaveBalanceGroupedCountInput : PagedLeaveBalanceResultRequestDto
    {
        public string GroupBy { get; set; }
    }

    public class LeaveBalanceStatsInput : PagedLeaveBalanceResultRequestDto
    {
        /// <summary>avg | sum | min | max | avgDayDiff</summary>
        public string Aggregate { get; set; }
        public string Field { get; set; }
        public string FromField { get; set; }
        public string ToField { get; set; }
    }
}
