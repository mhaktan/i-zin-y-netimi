using System;
using Abp.Application.Services.Dto;
using Abp.AutoMapper;

namespace IzinYonetimi.LeaveBalances.Dto
{
    [AutoMapFrom(typeof(Entities.LeaveBalance))]
    public class LeaveBalanceDto : EntityDto<long>
    {
        public int Year { get; set; }

        public int LeaveType { get; set; }

        public int TotalEntitlement { get; set; }

        public int UsedDays { get; set; }

        public int RemainingDays { get; set; }

        public long? UserId { get; set; }

        public string UserDisplay { get; set; }

        public DateTime CreationTime { get; set; }

        public DateTime? LastModificationTime { get; set; }

    }
}