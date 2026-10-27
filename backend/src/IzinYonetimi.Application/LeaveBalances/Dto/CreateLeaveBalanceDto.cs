using System;
using System.ComponentModel.DataAnnotations;
using Abp.AutoMapper;

namespace IzinYonetimi.LeaveBalances.Dto
{
    [AutoMapTo(typeof(Entities.LeaveBalance))]
    public class CreateLeaveBalanceDto
    {
        public int Year { get; set; }

        public int LeaveType { get; set; }

        public int TotalEntitlement { get; set; }

        public int UsedDays { get; set; }

        public int RemainingDays { get; set; }

        public long? UserId { get; set; }

    }
}