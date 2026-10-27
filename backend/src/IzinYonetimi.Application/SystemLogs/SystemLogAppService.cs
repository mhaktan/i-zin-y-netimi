using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;
using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.Runtime.Session;
using Abp.UI;
using Microsoft.EntityFrameworkCore;
using IzinYonetimi.Entities;

namespace IzinYonetimi.SystemLogs
{
    public class SystemLogDto
    {
        public long Id { get; set; }
        public DateTime Time { get; set; }
        public string Level { get; set; }
        public string Message { get; set; }
        public string Exception { get; set; }
        public string Source { get; set; }
        public string UserName { get; set; }
        public string Path { get; set; }
        public string RequestId { get; set; }
    }

    public class GetSystemLogsInput : PagedResultRequestDto
    {
        public string Level { get; set; }
        public string Search { get; set; }
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
    }

    public class LogSettingsDto
    {
        public int RetentionDays { get; set; }
        public int DefaultRetentionDays { get; set; }
    }

    /// <summary>Sistem loglari ve saklama suresi — yalniz Admin rolu</summary>
    [AbpAuthorize]
    public class SystemLogAppService : ApplicationService
    {
        public const string RetentionKey = "Log.RetentionDays";
        private readonly IRepository<SystemLog, long> _logs;
        private readonly IRepository<SystemSetting, long> _settings;
        private readonly IRepository<AppUser, long> _users;
        private readonly IRepository<AppRole, long> _roles;
        private readonly IRepository<UserRole, long> _userRoles;

        public SystemLogAppService(IRepository<SystemLog, long> logs, IRepository<SystemSetting, long> settings,
            IRepository<AppUser, long> users, IRepository<AppRole, long> roles, IRepository<UserRole, long> userRoles)
        {
            _logs = logs; _settings = settings; _users = users; _roles = roles; _userRoles = userRoles;
        }

        private async Task EnsureAdminAsync()
        {
            var uid = AbpSession.GetUserId();
            var adminRole = await _roles.GetAll().FirstOrDefaultAsync(r => r.Name == "Admin");
            if (adminRole == null || !await _userRoles.GetAll().AnyAsync(ur => ur.UserId == uid && ur.RoleId == adminRole.Id))
                throw new AbpAuthorizationException("Sistem loglarını yalnız yönetici görebilir.");
        }

        public async Task<PagedResultDto<SystemLogDto>> GetLogs(GetSystemLogsInput input)
        {
            await EnsureAdminAsync();
            var q = _logs.GetAll();
            if (!string.IsNullOrWhiteSpace(input.Level)) q = q.Where(l => l.Level == input.Level);
            if (!string.IsNullOrWhiteSpace(input.Search)) q = q.Where(l => l.Message.Contains(input.Search) || l.Path.Contains(input.Search));
            if (input.From.HasValue) q = q.Where(l => l.Time >= input.From.Value);
            if (input.To.HasValue) q = q.Where(l => l.Time < input.To.Value.AddDays(1));
            var total = await q.CountAsync();
            var rows = await q.OrderByDescending(l => l.Id).Skip(input.SkipCount).Take(Math.Min(input.MaxResultCount, 200)).ToListAsync();
            var ids = rows.Where(r => r.UserId.HasValue).Select(r => r.UserId.Value).Distinct().ToList();
            var names = await _users.GetAll().Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => ((u.Name ?? "") + " " + (u.Surname ?? "")).Trim());
            return new PagedResultDto<SystemLogDto>(total, rows.Select(r => new SystemLogDto
            {
                Id = r.Id, Time = r.Time, Level = r.Level, Message = r.Message, Exception = r.Exception, Source = r.Source,
                UserName = r.UserId.HasValue && names.TryGetValue(r.UserId.Value, out var n) ? n : null, Path = r.Path, RequestId = r.RequestId,
            }).ToList());
        }

        private static int DefaultDays() => int.TryParse(Environment.GetEnvironmentVariable("LOG_RETENTION_DAYS"), out var d) && d > 0 ? d : 30;

        public async Task<LogSettingsDto> GetSettings()
        {
            await EnsureAdminAsync();
            var v = await _settings.GetAll().Where(s => s.Key == RetentionKey).Select(s => s.Value).FirstOrDefaultAsync();
            return new LogSettingsDto { RetentionDays = int.TryParse(v, out var d) && d > 0 ? d : DefaultDays(), DefaultRetentionDays = DefaultDays() };
        }

        public async Task<LogSettingsDto> SetRetentionDays(int days)
        {
            await EnsureAdminAsync();
            if (days < 1 || days > 3650) throw new UserFriendlyException("Saklama süresi 1–3650 gün olmalı.");
            var row = await _settings.GetAll().FirstOrDefaultAsync(s => s.Key == RetentionKey);
            if (row == null) await _settings.InsertAsync(new SystemSetting { Key = RetentionKey, Value = days.ToString() });
            else row.Value = days.ToString();
            return new LogSettingsDto { RetentionDays = days, DefaultRetentionDays = DefaultDays() };
        }
    }

    public class ClientLogInput
    {
        public string Message { get; set; }
        public string Stack { get; set; }
        public string Url { get; set; }
    }

    /// <summary>Tarayicidaki beklenmeyen hatalar — kullanici basina dakikada en fazla 20</summary>
    [AbpAuthorize]
    public class ClientLogAppService : ApplicationService
    {
        private static readonly ConcurrentDictionary<long, (DateTime Window, int Count)> Rate = new ConcurrentDictionary<long, (DateTime, int)>();

        public void Write(ClientLogInput input)
        {
            var uid = AbpSession.GetUserId();
            var now = DateTime.UtcNow;
            var entry = Rate.AddOrUpdate(uid, _ => (now, 1), (_, e) => now - e.Window > TimeSpan.FromMinutes(1) ? (now, 1) : (e.Window, e.Count + 1));
            if (entry.Count > 20) return;
            string Cut(string s, int max) => string.IsNullOrEmpty(s) ? "" : s.Length <= max ? s : s.Substring(0, max);
            Logger.Warn($"[Tarayıcı] {Cut(input?.Message, 2000)} — {Cut(input?.Url, 500)}\n{Cut(input?.Stack, 4000)}");
        }
    }
}
