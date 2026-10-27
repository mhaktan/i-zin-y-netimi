using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Abp.Domain.Entities.Auditing;

namespace IzinYonetimi.Entities
{
    /// <summary>
    /// Logs every status transition for entities with state machine.
    /// </summary>
    [Table("StatusChangeLogs")]
    public class StatusChangeLog : CreationAuditedEntity<long>
    {
        [Required]
        [MaxLength(128)]
        public string EntityType { get; set; }

        [Required]
        [MaxLength(64)]
        public string EntityId { get; set; }

        [Required]
        [MaxLength(64)]
        public string FromStatus { get; set; }

        [Required]
        [MaxLength(64)]
        public string ToStatus { get; set; }

        [Required]
        [MaxLength(64)]
        public string Action { get; set; }

        [MaxLength(2000)]
        public string Comment { get; set; }

        public long? ChangedByUserId { get; set; }
    }
}
