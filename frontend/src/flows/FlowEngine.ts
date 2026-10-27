// Auto-generated flow engine runtime
// Do not edit — regenerated on each deploy

export interface FlowContext {
  variables: Record<string, unknown>;
  triggerData: Record<string, unknown>;
  baseApiUrl: string;
  authToken?: string;
}

export interface ExecutionResult {
  success: boolean;
  nodesExecuted: number;
  errors: Array<{ nodeId: string; nodeLabel: string; error: string }>;
  logs: string[];
}

export type FlowNodeDef = {
  id: string;
  type: string;
  label: string;
  [key: string]: unknown;
};

export type FlowEdgeDef = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  branch?: 'true' | 'false';
};

export type FlowDef = {
  id: string;
  name: string;
  enabled: boolean;
  nodes: FlowNodeDef[];
  edges: FlowEdgeDef[];
  variables: Array<{ name: string; type: string; defaultValue?: string }>;
};

/**
 * Execute a flow definition with the given context.
 * Walks the node graph starting from trigger nodes, following edges.
 */
export async function executeFlow(flow: FlowDef, ctx: FlowContext): Promise<ExecutionResult> {
  const result: ExecutionResult = { success: true, nodesExecuted: 0, errors: [], logs: [] };
  if (!flow.enabled) return result;

  // Initialize variables
  for (const v of flow.variables) {
    if (v.defaultValue !== undefined) {
      ctx.variables[v.name] = v.defaultValue;
    }
  }

  // Find trigger nodes (entry points)
  const triggerNodes = flow.nodes.filter(n => n.type === 'trigger');

  for (const trigger of triggerNodes) {
    await executeNode(trigger, flow, ctx, result);
  }

  if (result.errors.length > 0) {
    result.success = false;
  }
  return result;
}

async function executeNode(
  node: FlowNodeDef,
  flow: FlowDef,
  ctx: FlowContext,
  result: ExecutionResult,
  visited = new Set<string>()
): Promise<void> {
  // Cycle guard
  if (visited.has(node.id)) return;
  visited.add(node.id);
  result.nodesExecuted++;

  try {
    switch (node.type) {
      case 'trigger':
        // Entry point — proceed to connected nodes
        break;

      case 'action':
        await executeAction(node, ctx, result);
        break;

      case 'condition': {
        const condResult = evaluateCondition(node, ctx);
        const branch = condResult ? 'true' : 'false';
        const branchEdges = flow.edges.filter(
          e => e.sourceNodeId === node.id && e.branch === branch
        );
        for (const edge of branchEdges) {
          const target = flow.nodes.find(n => n.id === edge.targetNodeId);
          if (target) await executeNode(target, flow, ctx, result, new Set(visited));
        }
        return; // Skip default edge following
      }

      case 'loop': {
        const collectionKey = (node as Record<string, unknown>).collectionVariable as string;
        const itemVar = (node as Record<string, unknown>).itemVariable as string;
        const collection = ctx.variables[collectionKey];
        if (Array.isArray(collection)) {
          for (const item of collection) {
            // Isolate each iteration — clone variables so mutations don't bleed across
            const iterCtx: FlowContext = {
              ...ctx,
              variables: { ...ctx.variables, [itemVar]: item },
            };
            const nextEdges = flow.edges.filter(e => e.sourceNodeId === node.id);
            for (const edge of nextEdges) {
              const target = flow.nodes.find(n => n.id === edge.targetNodeId);
              if (target) await executeNode(target, flow, iterCtx, result, new Set(visited));
            }
          }
        }
        return;
      }

      case 'delay': {
        const ms = (node as Record<string, unknown>).delayMs as number;
        await new Promise(resolve => setTimeout(resolve, ms));
        break;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ nodeId: node.id, nodeLabel: node.label, error: msg });
    result.logs.push(`[Flow] Error at "${node.label}" (${node.type}): ${msg}`);
    return; // Don't follow edges from a failed node
  }

  // Follow outgoing edges (non-condition, non-loop)
  const outEdges = flow.edges.filter(e => e.sourceNodeId === node.id);
  for (const edge of outEdges) {
    const target = flow.nodes.find(n => n.id === edge.targetNodeId);
    if (target) await executeNode(target, flow, ctx, result, new Set(visited));
  }
}

async function executeAction(node: FlowNodeDef, ctx: FlowContext, result: ExecutionResult): Promise<void> {
  const action = (node as Record<string, unknown>).action as { type: string; config: Record<string, unknown> };
  if (!action) return;

  switch (action.type) {
    case 'api-call':
    case 'webhook': {
      const { method, url, headers, body, responseVariable } = action.config as {
        method: string; url: string; headers?: Record<string, string>; body?: string; responseVariable?: string;
      };
      const resolvedUrl = resolveTemplate(url, ctx);
      const resolvedBody = body ? resolveTemplate(body, ctx) : undefined;
      const res = await fetch(resolvedUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(ctx.authToken ? { Authorization: `Bearer ${ctx.authToken}` } : {}),
          ...headers,
        },
        body: resolvedBody,
      });
      if (responseVariable) {
        ctx.variables[responseVariable] = await res.json();
      }
      result.logs.push(`[Flow] ${action.type} ${method} ${resolvedUrl} → ${res.status}`);
      break;
    }

    case 'create-record':
    case 'update-record': {
      const { resourceName, fieldMappings, filter } = action.config as {
        resourceName: string; fieldMappings: Record<string, string>; filter?: Record<string, string>;
      };
      const data: Record<string, unknown> = {};
      for (const [key, expr] of Object.entries(fieldMappings)) {
        data[key] = resolveTemplate(expr, ctx);
      }
      const isUpdate = action.type === 'update-record';
      const endpoint = isUpdate ? 'Update' : 'Create';
      const filterParams = filter ? '?' + Object.entries(filter).map(([k, v]) => `${k}=${resolveTemplate(v, ctx)}`).join('&') : '';
      // ABP endpoint: /api/services/app/{Resource}/Create or /Update
      await fetch(`${ctx.baseApiUrl}/api/services/app/${resourceName}/${endpoint}${filterParams}`, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(ctx.authToken ? { Authorization: `Bearer ${ctx.authToken}` } : {}),
        },
        body: JSON.stringify(data),
      });
      result.logs.push(`[Flow] ${action.type} ${resourceName}`);
      break;
    }

    case 'delete-record': {
      const { resourceName, filter } = action.config as { resourceName: string; filter?: Record<string, string> };
      const filterParams = filter ? '?' + Object.entries(filter).map(([k, v]) => `${k}=${resolveTemplate(v, ctx)}`).join('&') : '';
      // ABP endpoint: /api/services/app/{Resource}/Delete
      await fetch(`${ctx.baseApiUrl}/api/services/app/${resourceName}/Delete${filterParams}`, {
        method: 'DELETE',
        headers: ctx.authToken ? { Authorization: `Bearer ${ctx.authToken}` } : {},
      });
      result.logs.push(`[Flow] delete-record ${resourceName}`);
      break;
    }

    case 'set-variable': {
      const { variableName, expression } = action.config as { variableName: string; expression: string };
      ctx.variables[variableName] = resolveTemplate(expression, ctx);
      break;
    }

    case 'log': {
      const { level, message } = action.config as { level: string; message: string };
      const resolved = resolveTemplate(message, ctx);
      result.logs.push(`[Flow/${level}] ${resolved}`);
      if (level === 'warn') console.warn('[Flow]', resolved);
      else if (level === 'error') console.error('[Flow]', resolved);
      else console.log('[Flow]', resolved);
      break;
    }

    case 'send-email':
    case 'send-notification':
    case 'run-sp':
    case 'transform-data':
      // These require backend integration — emit event for backend handler
      result.logs.push(`[Flow] ${action.type} — requires backend handler`);
      console.log(`[Flow] ${action.type} — requires backend handler`, action.config);
      break;
  }
}

function evaluateCondition(node: FlowNodeDef, ctx: FlowContext): boolean {
  const condition = (node as Record<string, unknown>).condition as {
    logic: 'and' | 'or';
    rules: Array<{ field: string; operator: string; value?: string }>;
  };
  if (!condition || !condition.rules.length) return true;
  const toNum = (v: string) => (v.trim() === '' ? NaN : Number(v));

  const results = condition.rules.map(rule => {
    const fieldValue = String(ctx.variables[rule.field] ?? ctx.triggerData[rule.field] ?? '');
    const compareValue = rule.value ? resolveTemplate(rule.value, ctx) : '';

    switch (rule.operator) {
      case 'equals': return fieldValue === compareValue;
      case 'not-equals': return fieldValue !== compareValue;
      // Bos deger sayi degildir (Number('') = 0 "tutar < 10000"i bos tutarda true yapiyordu); backend TryParse ile ayni
      case 'greater-than': return toNum(fieldValue) > toNum(compareValue);
      case 'less-than': return toNum(fieldValue) < toNum(compareValue);
      case 'contains': return fieldValue.includes(compareValue);
      case 'not-contains': return !fieldValue.includes(compareValue);
      case 'is-empty': return !fieldValue;
      case 'is-not-empty': return !!fieldValue;
      case 'regex': return new RegExp(compareValue).test(fieldValue);
      default: return false;
    }
  });

  return condition.logic === 'and' ? results.every(Boolean) : results.some(Boolean);
}

/**
 * Resolve {{variable}} and {{variable.path}} template expressions.
 */
function resolveTemplate(template: string, ctx: FlowContext): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path: string) => {
    const parts = path.split('.');
    let value: unknown;

    // Handle "triggerData.fieldName" → look directly in ctx.triggerData
    if (parts[0] === 'triggerData' && parts.length > 1) {
      value = ctx.triggerData[parts[1]];
      for (let i = 2; i < parts.length; i++) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[parts[i]];
        }
      }
    } else {
      // Try variables first, then triggerData as fallback
      value = ctx.variables[parts[0]] ?? ctx.triggerData[parts[0]];
      for (let i = 1; i < parts.length; i++) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[parts[i]];
        }
      }
    }

    return value !== undefined ? String(value) : '';
  });
}
