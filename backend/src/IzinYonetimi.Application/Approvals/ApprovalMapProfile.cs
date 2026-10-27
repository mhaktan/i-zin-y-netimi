using AutoMapper;
using IzinYonetimi.Approvals.Dto;
using IzinYonetimi.Entities;

namespace IzinYonetimi.Approvals
{
    public class ApprovalMapProfile : Profile
    {
        public ApprovalMapProfile()
        {
            CreateMap<ApprovalRecord, ApprovalRecordDto>();
            CreateMap<StatusChangeLog, StatusChangeLogDto>();
        }
    }
}
