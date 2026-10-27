using AutoMapper;
using IzinYonetimi.Entities;
using IzinYonetimi.LeaveRequests.Dto;

namespace IzinYonetimi.LeaveRequests
{
    public class LeaveRequestMapProfile : Profile
    {
        public LeaveRequestMapProfile()
        {
            CreateMap<LeaveRequest, LeaveRequestDto>()
                .ForMember(d => d.StatusName, o => o.MapFrom(s => s.Status.ToString()))
                .ForMember(d => d.UserDisplay, o => o.MapFrom(s => s.User != null ? s.User.Name.ToString() : null));
            CreateMap<CreateLeaveRequestDto, LeaveRequest>();
            CreateMap<LeaveRequestDto, LeaveRequest>();
        }
    }
}
