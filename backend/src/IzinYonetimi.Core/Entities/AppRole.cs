using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Abp.Domain.Entities.Auditing;

namespace IzinYonetimi.Entities
{
    public class AppRole : FullAuditedEntity<long>
    {
        [Required]
        [MaxLength(64)]
        public string Name { get; set; }

        [MaxLength(128)]
        public string DisplayName { get; set; }

        [MaxLength(512)]
        public string Description { get; set; }

        /// <summary>System roles (Admin, User) cannot be deleted or renamed.</summary>
        public bool IsSystem { get; set; } = false;

        public bool IsActive { get; set; } = true;

        public virtual ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
        public virtual ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
    }
}
