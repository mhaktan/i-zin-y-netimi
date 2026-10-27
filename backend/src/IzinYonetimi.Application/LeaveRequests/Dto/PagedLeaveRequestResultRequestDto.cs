using System;
using Abp.Application.Services.Dto;

namespace IzinYonetimi.LeaveRequests.Dto
{
    public class PagedLeaveRequestResultRequestDto : PagedAndSortedResultRequestDto
    {
        public string Keyword { get; set; }
        public long? UserId { get; set; }
        public int? LeaveType { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int? TotalDays { get; set; }
        public string Reason { get; set; }
        public string DoctorReportNote { get; set; }
        public int? Status { get; set; }
        public string RevisionNote { get; set; }
        public long? ManagerId { get; set; }
        public DateTime? StartDateFrom { get; set; }
        public DateTime? StartDateTo { get; set; }
        public DateTime? EndDateFrom { get; set; }
        public DateTime? EndDateTo { get; set; }
        public int? TotalDaysFrom { get; set; }
        public int? TotalDaysTo { get; set; }
        public long? ManagerIdFrom { get; set; }
        public long? ManagerIdTo { get; set; }
        /// <summary>Virgülle ayrılmış enum indeksleri — ör. "0,2"</summary>
        public string LeaveTypeIn { get; set; }
        public int? LeaveTypeNot { get; set; }
        /// <summary>Virgülle ayrılmış enum indeksleri — ör. "0,2"</summary>
        public string StatusIn { get; set; }
        public int? StatusNot { get; set; }
    }
}
