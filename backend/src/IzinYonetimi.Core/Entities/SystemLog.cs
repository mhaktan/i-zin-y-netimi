using System;
using Abp.Domain.Entities;

namespace IzinYonetimi.Entities
{
    public class SystemLog : Entity<long>
    {
        public DateTime Time { get; set; }
        /// <summary>Warning | Error | Fatal</summary>
        public string Level { get; set; }
        public string Message { get; set; }
        public string Exception { get; set; }
        public string Source { get; set; }
        public long? UserId { get; set; }
        public string Path { get; set; }
        public string RequestId { get; set; }
    }

    /// <summary>Uygulama ayarlari (anahtar/deger) — ornek: Log.RetentionDays</summary>
    public class SystemSetting : Entity<long>
    {
        public string Key { get; set; }
        public string Value { get; set; }
    }
}
