using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace IzinYonetimi.Approvals.Dto
{
    public class SubmitApprovalInput
    {
        [Required]
        public string EntityType { get; set; }

        [Required]
        public string EntityId { get; set; }

        [Required]
        public string FlowId { get; set; }

        [Required]
        public string NodeId { get; set; }

        /// <summary>User ID of the first approver. Null when AssigneeRole is set.</summary>
        public long? AssigneeUserId { get; set; }

        /// <summary>Role name — any member of this role can approve. Null when AssigneeUserId is set.</summary>
        public string AssigneeRole { get; set; }

        /// <summary>
        /// AssigneeUserId/AssigneeRole bos verilirse ilk adim bu tanimdan AssigneeResolver ile
        /// cozulur (akis motoru boyle gonderir — tum adimlar tek yerden cozulsun diye).
        /// </summary>
        public string AssigneeType { get; set; }
        public string AssigneeValue { get; set; }

        /// <summary>Akisi tetikleyen veri — "field" atamasinda entity'den once buraya bakilir.</summary>
        public Dictionary<string, object> TriggerData { get; set; }

        /// <summary>Ilk uygulanan adimin sirasi — onceki adimlar kosulla atlandiysa 0'dan buyuk.</summary>
        public int StepIndex { get; set; }

        /// <summary>Hicbir adimin kosulu saglanmadi: kayit StepIndex (= adim sayisi) kez ilerletilir, onay kaydi acilmaz.</summary>
        public bool NoApplicableStep { get; set; }

        /// <summary>Step name from approval config (e.g. "THY Chief Control")</summary>
        public string StepName { get; set; } = "";

        /// <summary>Resolved email subject (placeholders already substituted)</summary>
        public string EmailSubject { get; set; } = "";

        /// <summary>Resolved email body HTML (placeholders already substituted)</summary>
        public string EmailBody { get; set; } = "";
    }

    public class ProcessApprovalInput
    {
        [Required]
        public Guid ApprovalRecordId { get; set; }

        /// <summary>Action name: "Approve", "Revise", etc.</summary>
        [Required]
        public string Action { get; set; }

        /// <summary>Comment or revision reason</summary>
        public string Comment { get; set; }

        /// <summary>Next approver user ID (for field-based assignment)</summary>
        public long? NextAssigneeUserId { get; set; }
    }

    public class ApprovalRecordDto
    {
        public Guid Id { get; set; }
        public string EntityType { get; set; }
        public string EntityId { get; set; }
        public int StepIndex { get; set; }
        public string StepName { get; set; }
        public long? AssigneeUserId { get; set; }
        public string AssigneeRole { get; set; }
        public string Status { get; set; }
        public string ActionTaken { get; set; }
        public string Comment { get; set; }
        public DateTime? ActionDate { get; set; }
        public DateTime CreationTime { get; set; }
    }

    public class StatusChangeLogDto
    {
        public long Id { get; set; }
        public string EntityType { get; set; }
        public string EntityId { get; set; }
        public string FromStatus { get; set; }
        public string ToStatus { get; set; }
        public string Action { get; set; }
        public string Comment { get; set; }
        public long? ChangedByUserId { get; set; }
        public DateTime CreationTime { get; set; }
    }

    public class PendingApprovalDto
    {
        public Guid ApprovalRecordId { get; set; }
        public string EntityType { get; set; }
        public string EntityId { get; set; }
        public string StepName { get; set; }
        public DateTime CreationTime { get; set; }
        public List<string> AvailableActions { get; set; }
        /// <summary>Form number or reference code (if available)</summary>
        public string FormNo { get; set; }
        /// <summary>Short description</summary>
        public string Description { get; set; }
        /// <summary>Name of the user who created the form</summary>
        public string CreatorName { get; set; }
        /// <summary>Priority level</summary>
        public string Priority { get; set; }
    }
}
