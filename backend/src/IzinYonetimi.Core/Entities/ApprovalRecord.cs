using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Abp.Domain.Entities.Auditing;

namespace IzinYonetimi.Entities
{
    /// <summary>
    /// Tracks individual approval steps for any entity with an approval workflow.
    /// </summary>
    [Table("ApprovalRecords")]
    public class ApprovalRecord : FullAuditedEntity<Guid>
    {
        /// <summary>Entity type name (e.g. "MaintenanceSchedule")</summary>
        [Required]
        [MaxLength(128)]
        public string EntityType { get; set; }

        /// <summary>Record ID of the entity being approved</summary>
        [Required]
        [MaxLength(64)]
        public string EntityId { get; set; }

        /// <summary>Flow definition ID this approval belongs to</summary>
        [MaxLength(128)]
        public string FlowId { get; set; }

        /// <summary>Approval node ID in the flow</summary>
        [MaxLength(128)]
        public string NodeId { get; set; }

        /// <summary>Current step index (0-based)</summary>
        public int StepIndex { get; set; }

        /// <summary>Step name (e.g. "THY Chief Control")</summary>
        [MaxLength(256)]
        public string StepName { get; set; }

        /// <summary>User ID assigned to approve this step. Null when AssigneeRole is set (any user in role can approve).</summary>
        public long? AssigneeUserId { get; set; }

        /// <summary>Role name whose members can approve. Null when AssigneeUserId is set (specific user assigned).</summary>
        [MaxLength(128)]
        public string AssigneeRole { get; set; }

        /// <summary>Pending, Approved, Revised, Rejected, Cancelled</summary>
        [Required]
        [MaxLength(32)]
        // Iki onayci ayni kaydi ayni anda onaylarsa ikinci UPDATE (WHERE Status='Pending') 0 satir etkiler
        // ve istek geri alinir — aksi halde adim iki kez ilerler, sonraki onayci atlanirdi.
        [ConcurrencyCheck]
        public string Status { get; set; } = "Pending";

        /// <summary>Action taken: Approve, Revise, etc.</summary>
        [MaxLength(64)]
        public string ActionTaken { get; set; }

        /// <summary>Comment or revision reason</summary>
        [MaxLength(2000)]
        public string Comment { get; set; }

        /// <summary>When the action was taken</summary>
        public DateTime? ActionDate { get; set; }

        /// <summary>User ID who selected the next approver (for field-based assignment)</summary>
        public long? NextAssigneeUserId { get; set; }
    }
}
