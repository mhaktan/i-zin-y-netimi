// Auto-generated flow trigger hook
import { useCallback } from 'react';
import { executeFlow, type FlowContext, type ExecutionResult } from './FlowEngine';
import flowDefs from './flowDefinitions.json';

type CrudEvent = 'create' | 'update' | 'delete';

type FlowDefJson = {
  id: string;
  name: string;
  enabled: boolean;
  nodes: Array<{ id: string; type: string; label: string; trigger?: { type: string; resourceName?: string; fieldName?: string }; [key: string]: unknown }>;
  edges: Array<{ id: string; sourceNodeId: string; targetNodeId: string; branch?: 'true' | 'false' }>;
  variables: Array<{ name: string; type: string; defaultValue?: string }>;
};

/**
 * Hook that returns functions to trigger flows on CRUD events and field changes.
 */
export function useFlowTrigger(baseApiUrl: string, authToken?: string) {
  const triggerFlows = useCallback(
    async (event: CrudEvent, resourceName: string, data: Record<string, unknown>): Promise<void> => {
      const eventMap: Record<CrudEvent, string> = {
        create: 'on-create',
        update: 'on-update',
        delete: 'on-delete',
      };
      const triggerType = eventMap[event];

      for (const flow of flowDefs as unknown as FlowDefJson[]) {
        if (!flow.enabled) continue;

        const hasTrigger = flow.nodes.some(
          n =>
            n.type === 'trigger' &&
            n.trigger?.type === triggerType &&
            n.trigger?.resourceName === resourceName
        );

        if (hasTrigger) {
          const ctx: FlowContext = {
            variables: {},
            triggerData: data,
            baseApiUrl,
            authToken,
          };

          try {
            const result = await executeFlow(flow as any, ctx);
            if (!result.success) {
              console.warn(`[Flow] "${flow.name}" completed with errors:`, result.errors);
            }
          } catch (err) {
            console.error(`[Flow] Fatal error in "${flow.name}":`, err);
          }
        }
      }
    },
    [baseApiUrl, authToken]
  );

  const triggerFieldChange = useCallback(
    async (resourceName: string, fieldName: string, newValue: unknown, record: Record<string, unknown>): Promise<void> => {
      for (const flow of flowDefs as unknown as FlowDefJson[]) {
        if (!flow.enabled) continue;

        const hasTrigger = flow.nodes.some(
          n =>
            n.type === 'trigger' &&
            n.trigger?.type === 'on-field-change' &&
            n.trigger?.resourceName === resourceName &&
            n.trigger?.fieldName === fieldName
        );

        if (hasTrigger) {
          const ctx: FlowContext = {
            variables: {},
            triggerData: { ...record, [fieldName]: newValue, _changedField: fieldName, _newValue: newValue },
            baseApiUrl,
            authToken,
          };

          try {
            const result = await executeFlow(flow as any, ctx);
            if (!result.success) {
              console.warn(`[Flow] "${flow.name}" completed with errors:`, result.errors);
            }
          } catch (err) {
            console.error(`[Flow] Fatal error in "${flow.name}":`, err);
          }
        }
      }
    },
    [baseApiUrl, authToken]
  );

  const triggerManualFlow = useCallback(
    async (flowId: string, data: Record<string, unknown> = {}): Promise<void> => {
      const flow = (flowDefs as unknown as FlowDefJson[]).find(f => f.id === flowId && f.enabled);
      if (!flow) { console.warn('[Flow] Manual flow not found or disabled:', flowId); return; }
      console.log('[Flow] Manual trigger:', flow.name);
      const result = await executeFlow(flow as any, { variables: {}, triggerData: data, baseApiUrl, authToken });
      if (!result.success) console.warn('[Flow] Manual flow errors:', result.errors);
    },
    [baseApiUrl, authToken]
  );

  return { triggerFlows, triggerFieldChange, triggerManualFlow };
}
