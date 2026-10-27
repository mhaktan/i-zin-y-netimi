using AutoMapper;
using IzinYonetimi.Entities;
using IzinYonetimi.LeaveBalances.Dto;

namespace IzinYonetimi.LeaveBalances
{
    public class LeaveBalanceMapProfile : Profile
    {
        public LeaveBalanceMapProfile()
        {
            CreateMap<LeaveBalance, LeaveBalanceDto>()
                .ForMember(d => d.UserDisplay, o => o.MapFrom(s => s.User != null ? s.User.Name.ToString() : null));
            CreateMap<CreateLeaveBalanceDto, LeaveBalance>();
            CreateMap<LeaveBalanceDto, LeaveBalance>();
        }
    }
}
