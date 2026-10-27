using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Abp.Domain.Entities;
using Abp.Domain.Entities.Auditing;

namespace IzinYonetimi.Entities
{
    [Table("LeaveBalances")]
    public class LeaveBalance : FullAuditedEntity<long>
    {
        public int Year { get; set; }

        public LeaveBalanceLeaveType LeaveType { get; set; }

        public int TotalEntitlement { get; set; }

        public int UsedDays { get; set; }

        public int RemainingDays { get; set; }

        public long? UserId { get; set; }

        [ForeignKey(nameof(UserId))]
        public virtual AppUser User { get; set; }

    }
}