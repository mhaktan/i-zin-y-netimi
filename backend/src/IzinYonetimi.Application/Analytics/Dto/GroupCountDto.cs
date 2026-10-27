using System;

namespace IzinYonetimi.Analytics.Dto
{
    /// <summary>Gruplanmis sayim sonucu — GetGroupedCount doner.</summary>
    public class GroupCountDto
    {
        public string Key { get; set; }
        public string Label { get; set; }
        public int Count { get; set; }
    }
}
