using System;
using System.Collections.Generic;

using IzinYonetimi.Approvals.Dto;

namespace IzinYonetimi.LeaveRequests.Dto
{
    /// <summary>
    /// Rapor verisi — kok kayit ve alt koleksiyonlar tek yanitta.
    /// PDF sablonu tek apiBinding kullandigi icin nested donuyoruz.
    /// </summary>
    public class LeaveRequestReportDto
    {
        public LeaveRequestDto Data { get; set; }

        public List<ApprovalRecordDto> ApprovalHistory { get; set; }
    }
}
