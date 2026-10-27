using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using Castle.Core.Logging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Serilog.Core;
using Serilog.Events;
using IzinYonetimi.Entities;
using IzinYonetimi.EntityFrameworkCore;

namespace IzinYonetimi.Web.Host.Logging
{
    /// <summary>ABP/Castle Logger → Serilog (yapilandirilmazsa ABP NullLogger kullanir, hatalar kaybolur)</summary>
    public class SerilogCastleFactory : AbstractLoggerFactory
    {
        public override Castle.Core.Logging.ILogger Create(string name) => new SerilogCastleLogger(name, LoggerLevel.Debug);
        public override Castle.Core.Logging.ILogger Create(string name, LoggerLevel level) => new SerilogCastleLogger(name, level);
    }

    public class SerilogCastleLogger : LevelFilteredLogger
    {
        public SerilogCastleLogger(string name, LoggerLevel level) : base(name, level) { }
        public override Castle.Core.Logging.ILogger CreateChildLogger(string loggerName) => new SerilogCastleLogger(Name + "." + loggerName, Level);
        protected override void Log(LoggerLevel loggerLevel, string loggerName, string message, Exception exception)
        {
            var level = loggerLevel switch
            {
                LoggerLevel.Fatal => LogEventLevel.Fatal, LoggerLevel.Error => LogEventLevel.Error,
                LoggerLevel.Warn => LogEventLevel.Warning, LoggerLevel.Info => LogEventLevel.Information, _ => LogEventLevel.Debug,
            };
            Serilog.Log.ForContext("SourceContext", loggerName).Write(level, exception, "{Message:l}", message);
        }
    }

    public static class LogMask
    {
        // KVKK: sir ve kisisel veri loga yazilmaz (anahtar=deger / "anahtar":"deger" bicimleri)
        private static readonly Regex Secret = new Regex(
            @"(password|passwd|sifre|şifre|token|secret|authorization|bearer|tckn|tc_?kimlik|iban)(""?\s*[:=]\s*""?)([^\s,;""}]+)",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);
        public static string Apply(string s) => string.IsNullOrEmpty(s) ? s : Secret.Replace(s, "$1$2***");
    }

    /// <summary>Warning ve ustu → kuyruk; SystemLogWriter toplu yazar (istek yolunu bekletmez)</summary>
    public class SystemLogSink : ILogEventSink
    {
        public static readonly Channel<SystemLog> Queue = Channel.CreateBounded<SystemLog>(new BoundedChannelOptions(5000) { FullMode = BoundedChannelFullMode.DropOldest });

        private static string Prop(LogEvent e, string name) =>
            e.Properties.TryGetValue(name, out var v) ? (v as ScalarValue)?.Value?.ToString() ?? v.ToString().Trim('"') : null;

        public void Emit(LogEvent e)
        {
            if (e.Level < LogEventLevel.Warning) return;
            var source = Prop(e, "SourceContext") ?? "";
            // Yazicinin kendi EF hatalari tekrar kuyruga girmesin (sonsuz dongu)
            if (source.StartsWith("Microsoft.EntityFrameworkCore")) return;
            long.TryParse(Prop(e, "UserId"), out var uid);
            Queue.Writer.TryWrite(new SystemLog
            {
                Time = e.Timestamp.LocalDateTime,
                Level = e.Level.ToString(),
                Message = Trim(LogMask.Apply(e.RenderMessage()), 4000),
                Exception = Trim(LogMask.Apply(e.Exception?.ToString()), 16000),
                Source = Trim(source, 500),
                UserId = uid > 0 ? uid : (long?)null,
                Path = Trim(Prop(e, "RequestPath"), 1000),
                RequestId = Prop(e, "RequestId"),
            });
        }

        private static string Trim(string s, int max) => s == null || s.Length <= max ? s : s.Substring(0, max);
    }

    /// <summary>Kuyrugu 2 sn'de bir veritabanina yazar; gunde bir eski loglari siler (RUN_JOBS=false olan replikada silme yok)</summary>
    public class SystemLogWriter : BackgroundService
    {
        public const string RetentionKey = "Log.RetentionDays";
        private readonly IConfiguration _configuration;
        private DateTime _lastCleanup = DateTime.MinValue;

        public SystemLogWriter(IConfiguration configuration) { _configuration = configuration; }

        private IzinYonetimiDbContext OpenDb()
        {
            var optionsBuilder = new DbContextOptionsBuilder();
            var connStr = _configuration.GetConnectionString("Default");
            optionsBuilder.UseNpgsql(connStr);
            return new IzinYonetimiDbContext(optionsBuilder.Options);
        }

        public static int DefaultRetentionDays() =>
            int.TryParse(Environment.GetEnvironmentVariable("LOG_RETENTION_DAYS"), out var d) && d > 0 ? d : 30;

        public static int RetentionDays(IzinYonetimiDbContext db) =>
            int.TryParse(db.SystemSettings.Where(s => s.Key == RetentionKey).Select(s => s.Value).FirstOrDefault(), out var d) && d > 0 ? d : DefaultRetentionDays();

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); // migration once
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var batch = new List<SystemLog>();
                    while (batch.Count < 200 && SystemLogSink.Queue.Reader.TryRead(out var row)) batch.Add(row);
                    if (batch.Count > 0 || DateTime.Now - _lastCleanup > TimeSpan.FromDays(1))
                    {
                        using var db = OpenDb();
                        if (batch.Count > 0) { db.SystemLogs.AddRange(batch); await db.SaveChangesAsync(stoppingToken); }
                        if (DateTime.Now - _lastCleanup > TimeSpan.FromDays(1) && Environment.GetEnvironmentVariable("RUN_JOBS") != "false")
                        {
                            var cutoff = DateTime.Now.AddDays(-RetentionDays(db));
                            var removed = await db.SystemLogs.Where(l => l.Time < cutoff).ExecuteDeleteAsync(stoppingToken);
                            if (removed > 0) Console.WriteLine($"[Logs] {removed} eski log silindi (saklama {RetentionDays(db)} gun)");
                            _lastCleanup = DateTime.Now;
                        }
                    }
                }
                catch (Exception ex)
                {
                    // Log tablosu yazilamiyorsa uygulama durmasin; yalniz konsola
                    Console.WriteLine($"[Logs] SystemLogs yazilamadi: {ex.Message}");
                }
                await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
            }
        }
    }
}
