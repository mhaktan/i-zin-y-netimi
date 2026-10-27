using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Abp.Domain.Entities;
using Abp.Domain.Entities.Auditing;

namespace IzinYonetimi.Entities
{
    // State Machine: status — Draft → PendingHRApproval → PendingManagerApproval → Approved → Revision → Cancelled
    // Initial: Draft | Transitions: Draft→PendingHRApproval[Submit], PendingHRApproval→PendingManagerApproval[Approve], PendingHRApproval→Revision[Revise], PendingManagerApproval→Approved[Approve], PendingManagerApproval→Revision[Revise], Revision→PendingHRApproval[Resubmit], *→Cancelled[Cancel]
    [Table("LeaveRequests")]
    public class LeaveRequest : FullAuditedEntity<long>
    {
        public LeaveRequestLeaveType LeaveType { get; set; }

        public DateTime StartDate { get; set; }

        public DateTime EndDate { get; set; }

        public int TotalDays { get; set; }

        [MaxLength(1000)]
        public string Reason { get; set; }

        [MaxLength(500)]
        public string DoctorReportNote { get; set; }

        public LeaveRequestStatus Status { get; set; }

        [MaxLength(1000)]
        public string RevisionNote { get; set; }

        public long ManagerId { get; set; }

        public long? UserId { get; set; }

        [ForeignKey(nameof(UserId))]
        public virtual AppUser User { get; set; }

    }
}