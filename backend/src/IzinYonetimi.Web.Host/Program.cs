using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using IzinYonetimi.EntityFrameworkCore;
using IzinYonetimi.EntityFrameworkCore.Seed;
using IzinYonetimi.Entities;
using Serilog;

namespace IzinYonetimi.Web.Host
{
    /// <summary>
    /// Background service that runs migration + seed once at startup
    /// without blocking the HTTP pipeline.
    /// </summary>
    public class MigrationHostedService : IHostedService
    {
        private readonly IConfiguration _config;

        public MigrationHostedService(IConfiguration config)
        {
            _config = config;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            var connStr = _config.GetConnectionString("Default") ?? "";
            if (string.IsNullOrEmpty(connStr)) return;

            // Run in background to avoid blocking host startup (prevents EF tooling timeout)
            _ = Task.Run(async () =>
            {
                // Small delay to ensure host is fully started before DB operations
                await Task.Delay(1000, cancellationToken);
                try
                {
                    var optionsBuilder = new DbContextOptionsBuilder();
                    optionsBuilder.UseNpgsql(connStr);

                    using (var db = new IzinYonetimiDbContext(optionsBuilder.Options))
                    {
                        // EnsureCreated bos veritabaninda en guncel semayi kurar ve true doner.
                        // Dolu veritabaninda hicbir sey yapmaz — o durumda bekleyen migration'lar
                        // SchemaMigrations.Apply icinde sirayla calistirilir.
                        var freshlyCreated = db.Database.EnsureCreated();
                        Console.WriteLine("[Migration] Migration tanimi yok — sema EnsureCreated ile yonetiliyor.");
                        // Sistem log tablolari (sonradan eklenen surumde dolu DB'de EnsureCreated calismaz)
                        db.Database.ExecuteSqlRaw("CREATE TABLE IF NOT EXISTS \"SystemLogs\" (\"Id\" bigserial PRIMARY KEY, \"Time\" timestamp NOT NULL, \"Level\" text NULL, \"Message\" text NULL, \"Exception\" text NULL, \"Source\" text NULL, \"UserId\" bigint NULL, \"Path\" text NULL, \"RequestId\" text NULL)");
                        db.Database.ExecuteSqlRaw("CREATE TABLE IF NOT EXISTS \"SystemSettings\" (\"Id\" bigserial PRIMARY KEY, \"Key\" text NULL, \"Value\" text NULL)");
                        Console.WriteLine("[Migration] Database is up to date.");

                        // Seed sample data — wrapped in its own try so a failure here doesn't block RBAC seed below.
                        try
                        {
                    if (!db.LeaveRequests.Any())
                    {
                        db.LeaveRequests.AddRange(
                    new LeaveRequest { Id = 1, LeaveType = (LeaveRequestLeaveType)0, StartDate = DateTime.Today.AddDays(-3), EndDate = DateTime.Today.AddDays(-3), TotalDays = 42, Reason = "Örnek 1", DoctorReportNote = "Yıllık plan kapsamında hazırlandı.", Status = (LeaveRequestStatus)0, RevisionNote = "Yıllık plan kapsamında hazırlandı.", ManagerId = 1000L },
                    new LeaveRequest { Id = 2, LeaveType = (LeaveRequestLeaveType)1, StartDate = DateTime.Today.AddDays(-24), EndDate = DateTime.Today.AddDays(-24), TotalDays = 17, Reason = "Örnek 2", DoctorReportNote = "Departman talebi doğrultusunda güncellendi.", Status = (LeaveRequestStatus)3, RevisionNote = "Departman talebi doğrultusunda güncellendi.", ManagerId = 2000L }
                        );
                    }
                    if (!db.LeaveBalances.Any())
                    {
                        db.LeaveBalances.AddRange(
                    new LeaveBalance { Id = 3, Year = 42, LeaveType = (LeaveBalanceLeaveType)0, TotalEntitlement = 42, UsedDays = 42, RemainingDays = 42 },
                    new LeaveBalance { Id = 4, Year = 17, LeaveType = (LeaveBalanceLeaveType)1, TotalEntitlement = 17, UsedDays = 17, RemainingDays = 17 }
                        );
                    }
                            db.SaveChanges();
                            Console.WriteLine("[Seed] Sample data created.");
                        }
                        catch (Exception sampleEx)
                        {
                            Console.WriteLine($"[Seed] Sample data skipped: {sampleEx.GetType().Name}: {sampleEx.Message}");
                            // Carry on — RBAC seed must still run so admin/123qwe is usable.
                        }
                        // Sync identity sequences to MAX(Id). Seeded rows carry explicit Ids which do NOT
                        // advance Postgres identity sequences → nextval collides with a seed row and the
                        // first few inserts fail with a duplicate-key 500. Runs every startup; idempotent.
                        try
                        {
                            foreach (var et in db.Model.GetEntityTypes())
                            {
                                var pk = et.FindPrimaryKey();
                                var table = et.GetTableName();
                                if (pk == null || pk.Properties.Count != 1 || table == null) continue;
                                var pkType = Nullable.GetUnderlyingType(pk.Properties[0].ClrType) ?? pk.Properties[0].ClrType;
                                if (pkType != typeof(int) && pkType != typeof(long)) continue;
                                var col = pk.Properties[0].GetColumnName();
                                try
                                {
                                    db.Database.ExecuteSqlRaw("SELECT setval(pg_get_serial_sequence('\"" + table + "\"', '" + col + "'), (SELECT COALESCE(MAX(\"" + col + "\"), 0) FROM \"" + table + "\") + 1, false);");
                                }
                                catch (Exception seqTableEx)
                                {
                                    Console.WriteLine($"[Seed] Sequence sync skipped for {table}: {seqTableEx.Message}");
                                }
                            }
                            Console.WriteLine("[Seed] Identity sequences synced.");
                        }
                        catch (Exception seqEx)
                        {
                            Console.WriteLine($"[Seed] Sequence sync skipped: {seqEx.GetType().Name}: {seqEx.Message}");
                        }
                    }
                    // RBAC seed (Admin/User roles + permissions + admin user) runs through ABP DI
                    // so PermissionRegistry can be injected. SeedHelper is idempotent.
                    SeedHelper.SeedHostDb(Abp.Dependency.IocManager.Instance);
                    Console.WriteLine("[Seed] RBAC seed complete (Admin role + admin user).");
                }
                catch (Exception ex)
                {
                    // Full diagnostic — surface the real cause so silent seed failures are debuggable.
                    Console.WriteLine($"[Migration] FAILED: {ex.GetType().Name}: {ex.Message}");
                    if (ex.InnerException != null)
                        Console.WriteLine($"[Migration] InnerException: {ex.InnerException.GetType().Name}: {ex.InnerException.Message}");
                    Console.WriteLine("[Migration] StackTrace:");
                    Console.WriteLine(ex.StackTrace);
                    Console.WriteLine("[Migration] App continues without migration — admin user will not exist.");
                }
            }, cancellationToken);
        }

        public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }

    public class Program
    {
        // Runtime entry: WebHost is required because ABP Startup returns IServiceProvider.
        public static void Main(string[] args)
        {
            // Npgsql 7+ requires UTC DateTimes — enable legacy behavior for ABP compatibility
            AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

            // Loglar: konsola JSON (Railway toplar) + Warning ve ustu SystemLogs tablosuna (admin "Sistem Loglari")
            Serilog.Log.Logger = new Serilog.LoggerConfiguration()
                .MinimumLevel.Information()
                .MinimumLevel.Override("Microsoft", Serilog.Events.LogEventLevel.Warning)
                .MinimumLevel.Override("Microsoft.Hosting.Lifetime", Serilog.Events.LogEventLevel.Information)
                // ABP denetim kaydi ayni hatanin kopyasi ve istek parametrelerini icerebilir (kisisel veri) — yalniz Error
                .MinimumLevel.Override("Abp.Auditing", Serilog.Events.LogEventLevel.Error)
                .Enrich.FromLogContext()
                .WriteTo.Console(formatter: new Serilog.Formatting.Compact.RenderedCompactJsonFormatter())
                .WriteTo.Sink(new IzinYonetimi.Web.Host.Logging.SystemLogSink())
                .CreateLogger();
            WebHost.CreateDefaultBuilder(args)
                .UseStartup<Startup>()
                .Build()
                .Run();
        }

        // Design-time entry for EF Core tools (dotnet ef migrations).
        // Without this, EF tools wait 5 minutes for IHost build (resolver default timeout)
        // and then SIGTERM any running dotnet process — killing live dev servers.
        // We expose a minimal IHost that EF tools resolve in milliseconds; the actual
        // DbContext is built by IDesignTimeDbContextFactory in the EntityFrameworkCore project.
        public static IHostBuilder CreateHostBuilder(string[] args)
            => Microsoft.Extensions.Hosting.Host.CreateDefaultBuilder(args);
    }
}
