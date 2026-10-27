using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Cronos;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace IzinYonetimi.Flows
{
    public class FlowSchedulerService : BackgroundService
    {
        private readonly IFlowEngine _flowEngine;
        private readonly ILogger<FlowSchedulerService> _logger;

        public FlowSchedulerService(IFlowEngine flowEngine, ILogger<FlowSchedulerService> logger)
        {
            _flowEngine = flowEngine;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Birden fazla replikada yalniz birinde calissin: digerlerinde RUN_JOBS=false
            if (Environment.GetEnvironmentVariable("RUN_JOBS") == "false") return;
            var flows = LoadScheduledFlows();
            if (flows.Count == 0) return;

            _logger.LogInformation("FlowScheduler: {Count} scheduled flows loaded", flows.Count);
            // Cron kullanicinin yerel saatiyle yazilir ("0 9 * * *" = 09:00 Istanbul); UTC'de 12:00'de calisiyordu
            var tz = ResolveTimeZone();

            // shortcut: kilit yok, RUN_JOBS bayragi elle — Go Live tek replika acar; otomatik olcekleme gelirse pg_try_advisory_lock ile lider secimi.
            while (!stoppingToken.IsCancellationRequested)
            {
                var now = DateTimeOffset.UtcNow;
                foreach (var (flow, cron) in flows)
                {
                    var next = cron.GetNextOccurrence(now, tz);
                    if (next == null) continue;

                    var delay = next.Value - now;
                    if (delay.TotalSeconds < 60) // due within this minute
                    {
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                _logger.LogInformation("FlowScheduler: triggering {FlowName}", flow.Name);
                                // Yalniz bu akis: TriggerAsync ayni kaynaktaki TUM zamanlanmis akislari calistiriyordu
                                // (haftalik akis gunluk olanla birlikte her gun calisiyordu)
                                await _flowEngine.ExecuteFlowAsync(flow, new FlowContext());
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "FlowScheduler: error executing {FlowName}", flow.Name);
                            }
                        }, stoppingToken);
                    }
                }

                // Check every 60 seconds
                await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);
            }
        }

        private TimeZoneInfo ResolveTimeZone()
        {
            var id = Environment.GetEnvironmentVariable("FLOW_TIMEZONE");
            if (string.IsNullOrWhiteSpace(id)) id = "Europe/Istanbul";
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "FlowScheduler: unknown time zone {Tz}, using UTC", id);
                return TimeZoneInfo.Utc;
            }
        }

        private List<(FlowDefinition flow, CronExpression cron)> LoadScheduledFlows()
        {
            var result = new List<(FlowDefinition, CronExpression)>();
            var path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "flowDefinitions.json");
            if (!File.Exists(path)) return result;

            var json = File.ReadAllText(path);
            var flows = JsonSerializer.Deserialize<List<FlowDefinition>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();

            foreach (var flow in flows.Where(f => f.Enabled))
            {
                var scheduleTrigger = flow.Nodes
                    .FirstOrDefault(n => n.Type == "trigger" && n.Trigger?.Type == "schedule");
                if (scheduleTrigger?.Trigger?.CronExpression == null) continue;

                try
                {
                    var cron = CronExpression.Parse(scheduleTrigger.Trigger.CronExpression);
                    result.Add((flow, cron));
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "FlowScheduler: invalid cron for {FlowName}", flow.Name);
                }
            }

            return result;
        }
    }
}
