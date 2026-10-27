using System;
using Abp.Application.Services.Dto;
using Abp.AutoMapper;

namespace IzinYonetimi.LeaveRequests.Dto
{
    [AutoMapFrom(typeof(Entities.LeaveRequest))]
    public class LeaveRequestDto : EntityDto<long>
    {
        public int LeaveType { get; set; }

        public DateTime StartDate { get; set; }

        public DateTime EndDate { get; set; }

        public int TotalDays { get; set; }

        public string Reason { get; set; }

        public string DoctorReportNote { get; set; }

        public int Status { get; set; }

        public string RevisionNote { get; set; }

        public long ManagerId { get; set; }

        /// <summary>
        /// String form of the status — used by flow conditions (triggerData.statusName equals "PendingX").
        /// </summary>
        public string StatusName { get; set; }

        public long? UserId { get; set; }

        public string UserDisplay { get; set; }

        public DateTime CreationTime { get; set; }

        public DateTime? LastModificationTime { get; set; }

    }
}