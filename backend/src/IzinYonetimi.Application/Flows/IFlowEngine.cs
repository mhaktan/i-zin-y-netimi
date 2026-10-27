using System.Threading.Tasks;

namespace IzinYonetimi.Flows
{
    public interface IFlowEngine
    {
        Task<ExecutionResult> ExecuteFlowAsync(FlowDefinition flow, FlowContext context);
        Task TriggerAsync(string triggerType, string resourceName, object data);
        FlowDefinition GetFlowById(string flowId);
    }
}
