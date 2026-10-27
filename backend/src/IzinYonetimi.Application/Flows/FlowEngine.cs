using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Abp.Dependency;
using Abp.Net.Mail;
using Microsoft.Extensions.Logging;

namespace IzinYonetimi.Flows
{
    /// Onay baslatilamadi — yutulmaz, istegi (ve durum degisikligini) geri aldirir.
    /// Aksi halde kayit onay durumuna gecip kimsenin gelen kutusuna dusmeden kaliyordu.
    public class ApprovalStartException : Abp.UI.UserFriendlyException
    {
        public ApprovalStartException(string message) : base(message) { }
    }

    public class FlowEngine : IFlowEngine, ITransientDependency
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<FlowEngine> _logger;
        private readonly IEmailSender _emailSender;
        private List<FlowDefinition> _flowDefinitions;

        public FlowEngine(
            IHttpClientFactory httpClientFactory,
            IServiceProvider serviceProvider,
            ILogger<FlowEngine> logger,
            IEmailSender emailSender)
        {
            _httpClientFactory = httpClientFactory;
            _serviceProvider = serviceProvider;
            _logger = logger;
            _emailSender = emailSender;
        }

        public async Task TriggerAsync(string triggerType, string resourceName, object data)
        {
            var flows = GetFlowDefinitions();
            var matching = flows.Where(f => f.Enabled && f.Nodes.Any(n =>
                n.Type == "trigger" &&
                n.Trigger != null &&
                n.Trigger.Type == triggerType &&
                (string.IsNullOrEmpty(n.Trigger.ResourceName) || n.Trigger.ResourceName == resourceName)
            )).ToList();

            foreach (var flow in matching)
            {
                // CamelCase + string enums — enum integers in trigger data would never match
                // string conditions like "triggerData.status equals 'PendingManagerApproval'".
                var jsonOpts = new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
                };
                var ctx = new FlowContext
                {
                    TriggerData = JsonSerializer.Deserialize<Dictionary<string, object>>(
                        JsonSerializer.Serialize(data, jsonOpts)) ?? new()
                };
                await ExecuteFlowAsync(flow, ctx);
            }
        }

        public async Task<ExecutionResult> ExecuteFlowAsync(FlowDefinition flow, FlowContext context)
        {
            var result = new ExecutionResult { Success = true };

            if (!flow.Enabled)
                return result;

            // Load default variables
            foreach (var v in flow.Variables)
            {
                if (!string.IsNullOrEmpty(v.DefaultValue) && !context.Variables.ContainsKey(v.Name))
                    context.Variables[v.Name] = v.DefaultValue;
            }

            var visited = new HashSet<string>();
            var triggerNodes = flow.Nodes.Where(n => n.Type == "trigger").ToList();

            foreach (var trigger in triggerNodes)
            {
                await TraverseNode(trigger.Id, flow, context, visited, result);
            }

            result.VisitedNodeIds = visited.ToList();
            result.Success = !result.Log.Any(l => l.Status == "error");
            return result;
        }

        private async Task TraverseNode(
            string nodeId,
            FlowDefinition flow,
            FlowContext ctx,
            HashSet<string> visited,
            ExecutionResult result)
        {
            if (visited.Contains(nodeId)) return;
            visited.Add(nodeId);

            var node = flow.Nodes.FirstOrDefault(n => n.Id == nodeId);
            if (node == null) return;

            try
            {
                switch (node.Type)
                {
                    case "trigger":
                        result.Log.Add(new LogEntry
                        {
                            NodeId = nodeId, NodeLabel = node.Label,
                            Status = "executed", Message = $"trigger: {node.Trigger?.Type}"
                        });
                        foreach (var edge in GetOutgoingEdges(flow, nodeId))
                            await TraverseNode(edge.TargetNodeId, flow, ctx, visited, result);
                        break;

                    case "condition":
                        var condResult = EvaluateCondition(node.Condition, ctx);
                        var branch = condResult ? "true" : "false";
                        result.Log.Add(new LogEntry
                        {
                            NodeId = nodeId, NodeLabel = node.Label,
                            Status = "executed", Message = $"condition → {branch}"
                        });
                        var branchEdges = GetOutgoingEdges(flow, nodeId)
                            .Where(e => e.Branch == branch).ToList();
                        foreach (var edge in branchEdges)
                            await TraverseNode(edge.TargetNodeId, flow, ctx, visited, result);
                        break;

                    case "loop":
                        // Support both JsonElement arrays and JSON string arrays
                        JsonElement arr;
                        if (ctx.Variables.ContainsKey(node.CollectionVariable))
                        {
                            var raw = ctx.Variables[node.CollectionVariable];
                            if (raw is JsonElement je) arr = je;
                            else if (raw is string s && s.TrimStart().StartsWith("["))
                            {
                                try { arr = JsonSerializer.Deserialize<JsonElement>(s); }
                                catch { arr = default; }
                            }
                            else arr = default;
                        }
                        else arr = default;

                        if (arr.ValueKind != JsonValueKind.Array)
                        {
                            result.Log.Add(new LogEntry
                            {
                                NodeId = nodeId, NodeLabel = node.Label,
                                Status = "error",
                                Message = $"loop: {node.CollectionVariable} is not an array"
                            });
                            break;
                        }

                        var items = arr.EnumerateArray().ToList();
                        result.Log.Add(new LogEntry
                        {
                            NodeId = nodeId, NodeLabel = node.Label,
                            Status = "executed", Message = $"loop: {items.Count} items"
                        });

                        var bodyEdges = GetOutgoingEdges(flow, nodeId);
                        for (var i = 0; i < items.Count; i++)
                        {
                            ctx.Variables[node.ItemVariable] = items[i];
                            ctx.Variables[$"{node.ItemVariable}Index"] = i;
                            var iterVisited = new HashSet<string>();
                            foreach (var edge in bodyEdges)
                                await TraverseNode(edge.TargetNodeId, flow, ctx, iterVisited, result);
                        }
                        break;

                    case "delay":
                        await Task.Delay(node.DelayMs);
                        result.Log.Add(new LogEntry
                        {
                            NodeId = nodeId, NodeLabel = node.Label,
                            Status = "executed", Message = $"delay: {node.DelayMs}ms"
                        });
                        foreach (var edge in GetOutgoingEdges(flow, nodeId))
                            await TraverseNode(edge.TargetNodeId, flow, ctx, visited, result);
                        break;

                    case "action":
                        var msg = await ExecuteAction(node.Action, ctx);
                        result.Log.Add(new LogEntry
                        {
                            NodeId = nodeId, NodeLabel = node.Label,
                            Status = "executed", Message = msg
                        });
                        foreach (var edge in GetOutgoingEdges(flow, nodeId)
                            .Where(e => string.IsNullOrEmpty(e.Branch)))
                            await TraverseNode(edge.TargetNodeId, flow, ctx, visited, result);
                        break;

                    case "approval":
                        // Hand off to ApprovalAppService — creates ApprovalRecord, resolves
                        // assignee from context.TriggerData / fixed / role. Flow execution
                        // PAUSES here; ApprovalAppService.ProcessApprovalAsync resumes it.
                        if (node.Approval == null || node.Approval.Steps == null || node.Approval.Steps.Count == 0)
                        {
                            result.Log.Add(new LogEntry
                            {
                                NodeId = nodeId, NodeLabel = node.Label,
                                Status = "error",
                                Message = "Approval node missing steps configuration"
                            });
                            break;
                        }

                        // Kosulu saglanmayan adimlar atlanir (orn. "tutar > 50000 ise CFO")
                        var firstStepIndex = node.Approval.Steps.FindIndex(s => EvaluateCondition(s.Condition, ctx));
                        // Hic adim uygulanmiyorsa kayit tum onay durumlarini gecer (onay gerekmez)
                        var noApplicableStep = firstStepIndex < 0;
                        if (noApplicableStep) firstStepIndex = node.Approval.Steps.Count;
                        var firstStep = noApplicableStep ? null : node.Approval.Steps[firstStepIndex];
                        // Onayci burada cozulmez: adim tanimi + tetikleyen veri ApprovalAppService'e
                        // gider, ilk adim da sonrakiler gibi AssigneeResolver'dan gecer (tek kural).
                        // Extract entity id (case-insensitive: id / Id / ID)
                        var entityId = "";
                        var idKey = ctx.TriggerData.Keys.FirstOrDefault(k => string.Equals(k, "id", StringComparison.OrdinalIgnoreCase));
                        if (idKey != null) entityId = ctx.TriggerData[idKey]?.ToString() ?? "";

                        var entityType = flow.Nodes.FirstOrDefault(n => n.Type == "trigger")?.Trigger?.ResourceName ?? "";

                        try
                        {
                            // Resolve ApprovalAppService through DI (Castle Windsor / IIocResolver)
                            var iocResolver = _serviceProvider.GetService(typeof(Abp.Dependency.IIocResolver)) as Abp.Dependency.IIocResolver;
                            var appServiceType = System.Type.GetType("IzinYonetimi.Approvals.IApprovalAppService, IzinYonetimi.Application")
                                ?? throw new InvalidOperationException("IApprovalAppService type not found in IzinYonetimi.Application assembly");
                            var approvalSvc = iocResolver?.Resolve(appServiceType)
                                ?? throw new InvalidOperationException("ApprovalAppService not registered with DI container");

                            var submitInputType = System.Type.GetType("IzinYonetimi.Approvals.Dto.SubmitApprovalInput, IzinYonetimi.Application")!;
                            var submitInput = Activator.CreateInstance(submitInputType)!;
                            submitInputType.GetProperty("EntityType")!.SetValue(submitInput, entityType);
                            submitInputType.GetProperty("EntityId")!.SetValue(submitInput, entityId);
                            submitInputType.GetProperty("FlowId")!.SetValue(submitInput, flow.Id);
                            submitInputType.GetProperty("NodeId")!.SetValue(submitInput, nodeId);
                            submitInputType.GetProperty("AssigneeType")!.SetValue(submitInput, firstStep?.AssigneeType);
                            submitInputType.GetProperty("AssigneeValue")!.SetValue(submitInput, firstStep?.AssigneeValue);
                            submitInputType.GetProperty("TriggerData")!.SetValue(submitInput, new Dictionary<string, object>(ctx.TriggerData));
                            submitInputType.GetProperty("StepIndex")!.SetValue(submitInput, firstStepIndex);
                            submitInputType.GetProperty("NoApplicableStep")!.SetValue(submitInput, noApplicableStep);
                            submitInputType.GetProperty("StepName")!.SetValue(submitInput, firstStep?.Name ?? "Step 1");
                            submitInputType.GetProperty("EmailSubject")!.SetValue(submitInput,
                                ResolveTemplate(node.Approval.EmailSubjectTemplate ?? "", ctx));
                            submitInputType.GetProperty("EmailBody")!.SetValue(submitInput,
                                ResolveTemplate(node.Approval.EmailBodyTemplate ?? "", ctx));

                            var submitMethod = approvalSvc.GetType().GetMethod("SubmitForApprovalAsync")!;
                            await (Task)submitMethod.Invoke(approvalSvc, new[] { submitInput })!;

                            result.Log.Add(new LogEntry
                            {
                                NodeId = nodeId, NodeLabel = node.Label,
                                Status = "executed",
                                Message = noApplicableStep
                                    ? $"No approval step condition matched: {entityType} #{entityId} advanced past approval"
                                    : $"Approval requested: {entityType} #{entityId} → {firstStep.AssigneeType} '{firstStep.AssigneeValue}' (step '{firstStep.Name}')"
                            });
                        }
                        catch (Exception ex)
                        {
                            throw new ApprovalStartException($"Onay başlatılamadı: {ex.GetBaseException().Message}");
                        }
                        // Do NOT traverse outgoing edges — flow pauses until approval is processed
                        break;
                }
            }
            catch (Exception ex) when (ex is not ApprovalStartException)
            {
                result.Log.Add(new LogEntry
                {
                    NodeId = nodeId, NodeLabel = node.Label,
                    Status = "error", Message = ex.Message
                });
            }
        }

        private async Task<string> ExecuteAction(FlowAction action, FlowContext ctx)
        {
            if (action == null) return "no action configured";
            var client = _httpClientFactory.CreateClient();

            switch (action.Type)
            {
                case "api-call":
                case "webhook":
                {
                    var url = ResolveTemplate(GetConfigString(action, "url"), ctx);
                    var method = GetConfigString(action, "method", "GET");
                    var body = GetConfigString(action, "body");
                    var request = new HttpRequestMessage(new HttpMethod(method), url);
                    if (!string.IsNullOrEmpty(body))
                        request.Content = new StringContent(
                            ResolveTemplate(body, ctx), Encoding.UTF8, "application/json");
                    var resp = await client.SendAsync(request);
                    var responseBody = await resp.Content.ReadAsStringAsync();
                    var responseVar = GetConfigString(action, "responseVariable");
                    if (!string.IsNullOrEmpty(responseVar))
                    {
                        try { ctx.Variables[responseVar] = JsonSerializer.Deserialize<JsonElement>(responseBody); }
                        catch { ctx.Variables[responseVar] = responseBody; }
                    }
                    return $"{action.Type}: {method} {url} → {(int)resp.StatusCode}";
                }

                case "create-record":
                case "update-record":
                {
                    var resource = GetConfigString(action, "resourceName");
                    var endpoint = action.Type == "create-record" ? "Create" : "Update";
                    var httpMethod = action.Type == "create-record" ? HttpMethod.Post : HttpMethod.Put;
                    var payload = new Dictionary<string, string>();
                    if (action.Config.ContainsKey("fieldMappings") &&
                        action.Config["fieldMappings"] is JsonElement fm)
                    {
                        foreach (var prop in fm.EnumerateObject())
                            payload[prop.Name] = ResolveTemplate(prop.Value.GetString() ?? "", ctx);
                    }
                    var req = new HttpRequestMessage(httpMethod,
                        $"/api/services/app/{resource}/{endpoint}");
                    req.Content = new StringContent(
                        JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                    var resp = await client.SendAsync(req);
                    return $"{action.Type}: {resource} → {(int)resp.StatusCode}";
                }

                case "delete-record":
                {
                    var resource = GetConfigString(action, "resourceName");
                    var id = "";
                    if (action.Config.ContainsKey("filter") &&
                        action.Config["filter"] is JsonElement filter)
                    {
                        var first = filter.EnumerateObject().FirstOrDefault();
                        id = ResolveTemplate(first.Value.GetString() ?? "", ctx);
                    }
                    var resp = await client.DeleteAsync(
                        $"/api/services/app/{resource}/Delete?Id={id}");
                    return $"delete-record: {resource} → {(int)resp.StatusCode}";
                }

                case "set-variable":
                {
                    var name = GetConfigString(action, "variableName");
                    var expr = GetConfigString(action, "expression");
                    ctx.Variables[name] = ResolveTemplate(expr, ctx);
                    return $"set-variable: {name}";
                }

                case "transform-data":
                {
                    var src = GetConfigString(action, "sourceVariable");
                    var tgt = GetConfigString(action, "targetVariable");
                    if (ctx.Variables.ContainsKey(src))
                        ctx.Variables[tgt] = ctx.Variables[src];
                    return $"transform-data: {src} → {tgt}";
                }

                case "log":
                {
                    var msg = ResolveTemplate(GetConfigString(action, "message"), ctx);
                    _logger.LogInformation("[flow] {Message}", msg);
                    return $"log: {msg}";
                }

                case "send-email":
                {
                    var emailTo = ResolveTemplate(GetConfigString(action, "to"), ctx);
                    var emailCc = action.Config.ContainsKey("cc") ? ResolveTemplate(GetConfigString(action, "cc"), ctx) : null;
                    var emailSubject = ResolveTemplate(GetConfigString(action, "subject"), ctx);
                    var emailBody = ResolveTemplate(GetConfigString(action, "body"), ctx);
                    var emailContentType = action.Config.ContainsKey("contentType") ? GetConfigString(action, "contentType") : "html";
                    var isHtml = emailContentType == "html";

                    // Send to each recipient (comma-separated)
                    foreach (var recipient in emailTo.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                    {
                        await _emailSender.SendAsync(recipient, emailSubject, emailBody, isHtml);
                    }
                    // Send CC copies
                    if (!string.IsNullOrWhiteSpace(emailCc))
                    {
                        foreach (var ccRecipient in emailCc.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                        {
                            await _emailSender.SendAsync(ccRecipient, emailSubject, emailBody, isHtml);
                        }
                    }
                    return $"send-email: to={emailTo}" + (emailCc != null ? $", cc={emailCc}" : "");
                }

                case "send-notification":
                {
                    var notifTo = ResolveTemplate(GetConfigString(action, "to"), ctx);
                    var notifTitle = ResolveTemplate(GetConfigString(action, "title"), ctx);
                    var notifMessage = ResolveTemplate(GetConfigString(action, "message"), ctx);
                    _logger.LogInformation("[flow:notification] to={To}, title={Title}, message={Message}", notifTo, notifTitle, notifMessage);
                    // In-app notification — can be extended with push/SMS providers
                    return $"send-notification: to={notifTo}, title={notifTitle}";
                }

                case "run-sp":
                    return "run-sp: not implemented";

                default:
                    return $"unknown action: {action.Type}";
            }
        }

        private bool EvaluateCondition(FlowCondition condition, FlowContext ctx)
            => ConditionEvaluator.Evaluate(condition, field => ResolveVariable(field, ctx));

        private string ResolveTemplate(string template, FlowContext ctx)
        {
            if (string.IsNullOrEmpty(template)) return template;
            return Regex.Replace(template, @"\{\{(.+?)\}\}", match =>
            {
                var path = match.Groups[1].Value.Trim();
                return ResolveVariable(path, ctx);
            });
        }

        private string ResolveVariable(string path, FlowContext ctx)
        {
            if (string.IsNullOrEmpty(path)) return "";

            // Strip "triggerData."/"variables." prefixes so flow conditions and {{...}} templates
            // can use the intuitive notation. Without this, ResolvePath looks for a literal
            // "triggerData" key inside ctx.TriggerData and returns null → conditions silently fail.
            object val;
            if (path.StartsWith("triggerData.", StringComparison.OrdinalIgnoreCase))
                val = ResolvePath(ctx.TriggerData, path.Substring("triggerData.".Length));
            else if (path.StartsWith("variables.", StringComparison.OrdinalIgnoreCase))
                val = ResolvePath(ctx.Variables, path.Substring("variables.".Length));
            else
                val = ResolvePath(ctx.Variables, path) ?? ResolvePath(ctx.TriggerData, path);

            return val?.ToString() ?? "";
        }

        private object ResolvePath(Dictionary<string, object> dict, string path)
        {
            var parts = path.Split('.');
            object current = dict;
            foreach (var part in parts)
            {
                if (current is Dictionary<string, object> d)
                {
                    // Case-insensitive key lookup (C# serializes PascalCase, templates use camelCase)
                    var key = d.Keys.FirstOrDefault(k => string.Equals(k, part, StringComparison.OrdinalIgnoreCase));
                    if (key != null) current = d[key];
                    else return null;
                }
                else if (current is JsonElement je && je.ValueKind == JsonValueKind.Object)
                {
                    // JsonElement: try exact match first, then case-insensitive
                    if (je.TryGetProperty(part, out var prop)) current = prop;
                    else
                    {
                        var found = false;
                        foreach (var p in je.EnumerateObject())
                        {
                            if (string.Equals(p.Name, part, StringComparison.OrdinalIgnoreCase))
                            { current = p.Value; found = true; break; }
                        }
                        if (!found) return null;
                    }
                }
                else return null;
            }
            return current;
        }

        private List<FlowEdge> GetOutgoingEdges(FlowDefinition flow, string nodeId) =>
            flow.Edges.Where(e => e.SourceNodeId == nodeId).ToList();

        private string GetConfigString(FlowAction action, string key, string fallback = "")
        {
            if (action.Config.ContainsKey(key))
            {
                var val = action.Config[key];
                if (val is string s) return s;
                if (val is JsonElement je) return je.GetString() ?? fallback;
                return val?.ToString() ?? fallback;
            }
            return fallback;
        }

        private List<FlowDefinition> GetFlowDefinitions()
        {
            if (_flowDefinitions != null) return _flowDefinitions;

            var path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "flowDefinitions.json");
            if (!File.Exists(path))
            {
                _flowDefinitions = new List<FlowDefinition>();
                return _flowDefinitions;
            }

            var json = File.ReadAllText(path);
            _flowDefinitions = JsonSerializer.Deserialize<List<FlowDefinition>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
            return _flowDefinitions;
        }

        public FlowDefinition GetFlowById(string flowId)
        {
            return GetFlowDefinitions().FirstOrDefault(f => f.Id == flowId);
        }
    }
}
