using System;
using Abp.Application.Services.Dto;

namespace IzinYonetimi.LeaveBalances.Dto
{
    public class PagedLeaveBalanceResultRequestDto : PagedAndSortedResultRequestDto
    {
        public string Keyword { get; set; }
        public long? UserId { get; set; }
        public int? Year { get; set; }
        public int? LeaveType { get; set; }
        public int? TotalEntitlement { get; set; }
        public int? UsedDays { get; set; }
        public int? RemainingDays { get; set; }
        public int? YearFrom { get; set; }
        public int? YearTo { get; set; }
        public int? TotalEntitlementFrom { get; set; }
        public int? TotalEntitlementTo { get; set; }
        public int? UsedDaysFrom { get; set; }
        public int? UsedDaysTo { get; set; }
        public int? RemainingDaysFrom { get; set; }
        public int? RemainingDaysTo { get; set; }
        /// <summary>Virgülle ayrılmış enum indeksleri — ör. "0,2"</summary>
        public string LeaveTypeIn { get; set; }
        public int? LeaveTypeNot { get; set; }
    }
}
