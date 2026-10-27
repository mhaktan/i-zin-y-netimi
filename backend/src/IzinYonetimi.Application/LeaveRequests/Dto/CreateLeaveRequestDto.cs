using System;
using System.ComponentModel.DataAnnotations;
using Abp.AutoMapper;

namespace IzinYonetimi.LeaveRequests.Dto
{
    [AutoMapTo(typeof(Entities.LeaveRequest))]
    public class CreateLeaveRequestDto
    {
        public int LeaveType { get; set; }

        public DateTime StartDate { get; set; }

        public DateTime EndDate { get; set; }

        public int TotalDays { get; set; }

        [MaxLength(1000)]
        public string Reason { get; set; }

        [MaxLength(500)]
        public string DoctorReportNote { get; set; }

        public int Status { get; set; }

        [MaxLength(1000)]
        public string RevisionNote { get; set; }

        public long ManagerId { get; set; }

        public long? UserId { get; set; }

    }
}