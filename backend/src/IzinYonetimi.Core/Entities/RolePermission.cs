using System;
using System.ComponentModel.DataAnnotations;
using Abp.Domain.Entities.Auditing;

namespace IzinYonetimi.Entities
{
    public class RolePermission : CreationAuditedEntity<long>
    {
        public long RoleId { get; set; }
        public virtual AppRole Role { get; set; }

        /// <summary>Permission name from PermissionRegistry, e.g. "MaintenanceSchedule.Create"</summary>
        [Required]
        [MaxLength(128)]
        public string PermissionName { get; set; }
    }
}
