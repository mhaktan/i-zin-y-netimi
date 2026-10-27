using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Abp.Domain.Entities.Auditing;

namespace IzinYonetimi.Entities
{
    public class AppUser : FullAuditedEntity<long>
    {
        [Required]
        [MaxLength(64)]
        public string UserName { get; set; }

        [Required]
        [MaxLength(256)]
        public string EmailAddress { get; set; }

        [Required]
        [MaxLength(128)]
        public string Name { get; set; }

        [MaxLength(128)]
        public string Surname { get; set; }

        [Required]
        public string PasswordHash { get; set; }

        public bool IsActive { get; set; } = true;

        // N:N roles via UserRole junction
        public virtual ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    }
}
