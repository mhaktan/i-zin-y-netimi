import React from 'react';
import { UiCard } from '../../shared/ui';

import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';

import { API_BASE } from '../../config';
import { authFetch } from '../../dataProvider';
import { formatDate } from '../../shared/format';
const cellText = (v: unknown): string => typeof v === 'boolean' ? (v ? "Evet" : "Hayır") : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? formatDate(v, !/T00:00:00/.test(v)) : String(v ?? '');


const LOADING_KEYFRAMES = `
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
@keyframes spin { to { transform: rotate(360deg); } }
`;

export const DashboardScreen: React.FC = () => {
  const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
    const direct = path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object') ? (o as Record<string, unknown>)[k] : undefined, obj);
    if (direct !== undefined) return direct;
    // Fallback: try last segment at top level (handles ABP-style {result: {...}} unwrapping)
    const segments = path.split('.');
    if (segments.length > 1 && obj && typeof obj === "object") {
      const lastKey = segments[segments.length - 1];
      const top = (obj as Record<string, unknown>)[lastKey];
      if (top !== undefined) return top;
    }
    return undefined;
  };

  const sharedGet = (url: string): Promise<Response> => {
    const cache = ((window as unknown as { __dashCache?: Map<string, Promise<Response>> }).__dashCache ??= new Map());
    let p = cache.get(url);
    if (!p) { p = authFetch(url); cache.set(url, p); setTimeout(() => cache.delete(url), 10_000); }
    return p.then((r: Response) => r.clone());
  };

  // Unwrap common API envelopes: ABP {result, __abp}, generic {data}, etc.
  const unwrapResponse = (json: unknown): unknown => {
    if (!json || typeof json !== "object" || Array.isArray(json)) return json;
    const obj = json as Record<string, unknown>;
    // ABP envelope: {result, success, error, __abp}
    if ("__abp" in obj && "result" in obj) return obj.result;
    // Generic envelope: {success: true, data: X}
    if ("success" in obj && "data" in obj && Object.keys(obj).length <= 4) return obj.data;
    return json;
  };

  const extractArray = (json: unknown): Record<string, unknown>[] => {
    if (Array.isArray(json)) return json;
    if (json && typeof json === 'object') {
      const obj = json as Record<string, unknown>;
      for (const key of ['items', 'data', 'results', 'records', 'rows', 'list']) {
        if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
      }
      // Recurse one level — handles {result: {items: [...]}}
      for (const val of Object.values(obj)) {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const inner = val as Record<string, unknown>;
          for (const key of ['items', 'data', 'results', 'records', 'rows', 'list']) {
            if (Array.isArray(inner[key])) return inner[key] as Record<string, unknown>[];
          }
        }
        if (Array.isArray(val)) return val as Record<string, unknown>[];
      }
    }
    return [];
  };

  const [mytasks_0Data, setMytasks_0Data] = React.useState<Record<string, unknown> | null>(null);
  const [mytasks_0Loading, setMytasks_0Loading] = React.useState(true);
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await sharedGet(`${API_BASE}/api/services/app/Approval/GetMyPendingApprovals`);
        // Token expired or invalid — clear auth and redirect to login
        if (res.status === 401) {
          ['_auth_token', '_bearer_token', '_refresh_token'].forEach(k => localStorage.removeItem(k));
          if (window.location.pathname !== '/login') window.location.href = '/login';
          return;
        }
        if (!res.ok) return;
        const rawJson = await res.json();
        // Auto-unwrap ABP/generic envelopes so {result.totalCount} or bare {totalCount} both work
        const json = unwrapResponse(rawJson) as Record<string, unknown>;
        setMytasks_0Data(json);
      } catch { /* ignore */ }
      finally { setMytasks_0Loading(false); }
    };
    fetchData();
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, []);

  const [count_leaveRequest_1Data, setCount_leaveRequest_1Data] = React.useState<Record<string, unknown> | null>(null);
  const [count_leaveRequest_1Loading, setCount_leaveRequest_1Loading] = React.useState(true);
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await sharedGet(`${API_BASE}/api/services/app/LeaveRequest/GetAll?StatusIn=1%2C2&MaxResultCount=1`);
        // Token expired or invalid — clear auth and redirect to login
        if (res.status === 401) {
          ['_auth_token', '_bearer_token', '_refresh_token'].forEach(k => localStorage.removeItem(k));
          if (window.location.pathname !== '/login') window.location.href = '/login';
          return;
        }
        if (!res.ok) return;
        const rawJson = await res.json();
        // Auto-unwrap ABP/generic envelopes so {result.totalCount} or bare {totalCount} both work
        const json = unwrapResponse(rawJson) as Record<string, unknown>;
        setCount_leaveRequest_1Data(json);
      } catch { /* ignore */ }
      finally { setCount_leaveRequest_1Loading(false); }
    };
    fetchData();
  }, []);

  const [count_leaveRequest_2Data, setCount_leaveRequest_2Data] = React.useState<Record<string, unknown> | null>(null);
  const [count_leaveRequest_2Loading, setCount_leaveRequest_2Loading] = React.useState(true);
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await sharedGet(`${API_BASE}/api/services/app/LeaveRequest/GetAll?Status=3&MaxResultCount=1`);
        // Token expired or invalid — clear auth and redirect to login
        if (res.status === 401) {
          ['_auth_token', '_bearer_token', '_refresh_token'].forEach(k => localStorage.removeItem(k));
          if (window.location.pathname !== '/login') window.location.href = '/login';
          return;
        }
        if (!res.ok) return;
        const rawJson = await res.json();
        // Auto-unwrap ABP/generic envelopes so {result.totalCount} or bare {totalCount} both work
        const json = unwrapResponse(rawJson) as Record<string, unknown>;
        setCount_leaveRequest_2Data(json);
      } catch { /* ignore */ }
      finally { setCount_leaveRequest_2Loading(false); }
    };
    fetchData();
  }, []);

  const [breakdown_leaveRequest_3Data, setBreakdown_leaveRequest_3Data] = React.useState<Record<string, unknown>[]>([]);
  const [breakdown_leaveRequest_3Loading, setBreakdown_leaveRequest_3Loading] = React.useState(true);
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await sharedGet(`${API_BASE}/api/services/app/LeaveRequest/GetGroupedCount?GroupBy=LeaveType`);
        // Token expired or invalid — clear auth and redirect to login
        if (res.status === 401) {
          ['_auth_token', '_bearer_token', '_refresh_token'].forEach(k => localStorage.removeItem(k));
          if (window.location.pathname !== '/login') window.location.href = '/login';
          return;
        }
        if (!res.ok) return;
        const rawJson = await res.json();
        // Auto-unwrap ABP/generic envelopes so {result.totalCount} or bare {totalCount} both work
        const json = unwrapResponse(rawJson) as Record<string, unknown>;
        const target = getNestedValue(rawJson as Record<string, unknown>, 'result') ?? getNestedValue(json, 'result');
        setBreakdown_leaveRequest_3Data(extractArray(target ?? json));
      } catch { /* ignore */ }
      finally { setBreakdown_leaveRequest_3Loading(false); }
    };
    fetchData();
  }, []);

  const [breakdown_leaveRequest_4Data, setBreakdown_leaveRequest_4Data] = React.useState<Record<string, unknown>[]>([]);
  const [breakdown_leaveRequest_4Loading, setBreakdown_leaveRequest_4Loading] = React.useState(true);
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await sharedGet(`${API_BASE}/api/services/app/LeaveRequest/GetGroupedCount?GroupBy=Status`);
        // Token expired or invalid — clear auth and redirect to login
        if (res.status === 401) {
          ['_auth_token', '_bearer_token', '_refresh_token'].forEach(k => localStorage.removeItem(k));
          if (window.location.pathname !== '/login') window.location.href = '/login';
          return;
        }
        if (!res.ok) return;
        const rawJson = await res.json();
        // Auto-unwrap ABP/generic envelopes so {result.totalCount} or bare {totalCount} both work
        const json = unwrapResponse(rawJson) as Record<string, unknown>;
        const target = getNestedValue(rawJson as Record<string, unknown>, 'result') ?? getNestedValue(json, 'result');
        setBreakdown_leaveRequest_4Data(extractArray(target ?? json));
      } catch { /* ignore */ }
      finally { setBreakdown_leaveRequest_4Loading(false); }
    };
    fetchData();
  }, []);

  const [chart_groupbyData, setChart_groupbyData] = React.useState<Record<string, unknown>[]>([]);
  const [chart_groupbyLoading, setChart_groupbyLoading] = React.useState(true);
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await sharedGet(`${API_BASE}/api/services/app/LeaveRequest/GetGroupedCount?GroupBy=StartDate`);
        // Token expired or invalid — clear auth and redirect to login
        if (res.status === 401) {
          ['_auth_token', '_bearer_token', '_refresh_token'].forEach(k => localStorage.removeItem(k));
          if (window.location.pathname !== '/login') window.location.href = '/login';
          return;
        }
        if (!res.ok) return;
        const rawJson = await res.json();
        // Auto-unwrap ABP/generic envelopes so {result.totalCount} or bare {totalCount} both work
        const json = unwrapResponse(rawJson) as Record<string, unknown>;
        const target = getNestedValue(rawJson as Record<string, unknown>, 'result') ?? getNestedValue(json, 'result');
        setChart_groupbyData(extractArray(target ?? json));
      } catch { /* ignore */ }
      finally { setChart_groupbyLoading(false); }
    };
    fetchData();
  }, []);

  const [list_leaveRequest_5_tableData, setList_leaveRequest_5_tableData] = React.useState<Record<string, unknown> | null>(null);
  const [list_leaveRequest_5_tableLoading, setList_leaveRequest_5_tableLoading] = React.useState(true);
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await sharedGet(`${API_BASE}/api/services/app/LeaveRequest/GetAll?StartDateFrom=2026-10-27&Status=3&MaxResultCount=10&Sorting=id%20desc`);
        // Token expired or invalid — clear auth and redirect to login
        if (res.status === 401) {
          ['_auth_token', '_bearer_token', '_refresh_token'].forEach(k => localStorage.removeItem(k));
          if (window.location.pathname !== '/login') window.location.href = '/login';
          return;
        }
        if (!res.ok) return;
        const rawJson = await res.json();
        // Auto-unwrap ABP/generic envelopes so {result.totalCount} or bare {totalCount} both work
        const json = unwrapResponse(rawJson) as Record<string, unknown>;
        const target = getNestedValue(rawJson as Record<string, unknown>, 'result.items') ?? getNestedValue(json, 'result.items');
        setList_leaveRequest_5_tableData(target != null ? (target as Record<string, unknown>) : json);
      } catch { /* ignore */ }
      finally { setList_leaveRequest_5_tableLoading(false); }
    };
    fetchData();
  }, []);

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: LOADING_KEYFRAMES }} />
      <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700 }}>{"Gösterge Paneli"}</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
        <div style={{ gridColumn: 'span 12' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ gridColumn: 'span 1' }}>
              {mytasks_0Loading ? (
                <UiCard bodyStyle={{ padding: 20 }}>
                  <div style={{ height: 12, width: '40%', background: '#e0e0e0', borderRadius: 4, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: 28, width: '60%', background: '#e0e0e0', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: 10, width: '50%', background: '#f0f0f0', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
                </UiCard>
              ) : (
              <UiCard bodyStyle={{ padding: 20 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Onayımı Bekleyen Talepler</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1976d2' }}>{Array.isArray((Array.isArray(mytasks_0Data) ? mytasks_0Data as unknown[] : mytasks_0Data?.['result'])) ? ((Array.isArray(mytasks_0Data) ? mytasks_0Data as unknown[] : mytasks_0Data?.['result']) as unknown[]).length : (((Array.isArray(mytasks_0Data) ? mytasks_0Data as unknown[] : mytasks_0Data?.['result']) as string | number) ?? '—')}</div>
              </UiCard>
              )}

            </div>
            <div style={{ gridColumn: 'span 1' }}>
              {count_leaveRequest_1Loading ? (
                <UiCard bodyStyle={{ padding: 20 }}>
                  <div style={{ height: 12, width: '40%', background: '#e0e0e0', borderRadius: 4, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: 28, width: '60%', background: '#e0e0e0', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: 10, width: '50%', background: '#f0f0f0', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
                </UiCard>
              ) : (
              <UiCard bodyStyle={{ padding: 20 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Onay Bekleyen Talepler</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#4caf50' }}>{(getNestedValue(count_leaveRequest_1Data ?? {}, 'result.totalCount') as string | number) ?? '—'}</div>
              </UiCard>
              )}

            </div>
            <div style={{ gridColumn: 'span 1' }}>
              {count_leaveRequest_2Loading ? (
                <UiCard bodyStyle={{ padding: 20 }}>
                  <div style={{ height: 12, width: '40%', background: '#e0e0e0', borderRadius: 4, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: 28, width: '60%', background: '#e0e0e0', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: 10, width: '50%', background: '#f0f0f0', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
                </UiCard>
              ) : (
              <UiCard bodyStyle={{ padding: 20 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Onaylanan Talepler</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#ff9800' }}>{(getNestedValue(count_leaveRequest_2Data ?? {}, 'result.totalCount') as string | number) ?? '—'}</div>
              </UiCard>
              )}

            </div>
          </div>
        </div>
        <div style={{ gridColumn: 'span 6' }}>
          {breakdown_leaveRequest_3Loading ? (
            <UiCard header="İzin Türüne Göre Dağılım" bodyStyle={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, border: '3px solid #e0e0e0', borderTopColor: '#1976d2', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 12, color: '#999' }}>{"Yükleniyor…"}</span>
              </div>
            </UiCard>
          ) : (
          <UiCard header="İzin Türüne Göre Dağılım" bodyStyle={{ padding: 16 }}>
            {breakdown_leaveRequest_3Data.filter((d) => Number(d['count']) > 0).length <= 1 ? (
              <div style={{ height: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {breakdown_leaveRequest_3Data.some((d) => Number(d['count']) > 0) ? (<>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#1a1a2e' }}>{String(breakdown_leaveRequest_3Data.find((d) => Number(d['count']) > 0)?.['count'] ?? '')}</div>
                  <div style={{ fontSize: 13, color: '#777' }}>{String(breakdown_leaveRequest_3Data.find((d) => Number(d['count']) > 0)?.['label'] ?? '')}</div>
                </>) : <span style={{ fontSize: 13, color: '#999' }}>{"Kayıt yok"}</span>}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={breakdown_leaveRequest_3Data} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label>
                      <Cell fill="#1976d2" />
                      <Cell fill="#ff9800" />
                      <Cell fill="#4caf50" />
                      <Cell fill="#e91e63" />
                      <Cell fill="#9c27b0" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
            )}
          </UiCard>
          )}
        </div>
        <div style={{ gridColumn: 'span 6' }}>
          {breakdown_leaveRequest_4Loading ? (
            <UiCard header="Duruma Göre Talepler" bodyStyle={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, border: '3px solid #e0e0e0', borderTopColor: '#1976d2', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 12, color: '#999' }}>{"Yükleniyor…"}</span>
              </div>
            </UiCard>
          ) : (
          <UiCard header="Duruma Göre Talepler" bodyStyle={{ padding: 16 }}>
            {breakdown_leaveRequest_4Data.filter((d) => Number(d['count']) > 0).length <= 1 ? (
              <div style={{ height: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {breakdown_leaveRequest_4Data.some((d) => Number(d['count']) > 0) ? (<>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#1a1a2e' }}>{String(breakdown_leaveRequest_4Data.find((d) => Number(d['count']) > 0)?.['count'] ?? '')}</div>
                  <div style={{ fontSize: 13, color: '#777' }}>{String(breakdown_leaveRequest_4Data.find((d) => Number(d['count']) > 0)?.['label'] ?? '')}</div>
                </>) : <span style={{ fontSize: 13, color: '#999' }}>{"Kayıt yok"}</span>}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={breakdown_leaveRequest_4Data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#1976d2" />
                  </BarChart>
                </ResponsiveContainer>
            )}
          </UiCard>
          )}
        </div>
        <div style={{ gridColumn: 'span 12' }}>
          {chart_groupbyLoading ? (
            <UiCard header="Aylık İzin Talepleri" bodyStyle={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, border: '3px solid #e0e0e0', borderTopColor: '#1976d2', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 12, color: '#999' }}>{"Yükleniyor…"}</span>
              </div>
            </UiCard>
          ) : (
          <UiCard header="Aylık İzin Talepleri" bodyStyle={{ padding: 16 }}>
            {chart_groupbyData.filter((d) => Number(d['count']) > 0).length <= 1 ? (
              <div style={{ height: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {chart_groupbyData.some((d) => Number(d['count']) > 0) ? (<>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#1a1a2e' }}>{String(chart_groupbyData.find((d) => Number(d['count']) > 0)?.['count'] ?? '')}</div>
                  <div style={{ fontSize: 13, color: '#777' }}>{String(chart_groupbyData.find((d) => Number(d['count']) > 0)?.['label'] ?? '')}</div>
                </>) : <span style={{ fontSize: 13, color: '#999' }}>{"Kayıt yok"}</span>}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chart_groupbyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#1976d2" />
                  </BarChart>
                </ResponsiveContainer>
            )}
          </UiCard>
          )}
        </div>
        <div style={{ gridColumn: 'span 12' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>Yaklaşan İzinler</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
            <div style={{ gridColumn: 'span 1' }}>
              <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #e8e8e8' }}>
                {list_leaveRequest_5_tableLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>Loading...</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontSize: 12, color: '#666' }}>Leave Type</th><th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontSize: 12, color: '#666' }}>Start Date</th><th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontSize: 12, color: '#666' }}>End Date</th><th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontSize: 12, color: '#666' }}>Total Days</th></tr></thead>
                    <tbody>
                      {(Array.isArray(list_leaveRequest_5_tableData) ? list_leaveRequest_5_tableData : extractArray(list_leaveRequest_5_tableData)).map((row: Record<string, unknown>, i: number) => (
                        <tr key={i}><td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>{cellText(row["leaveType"])}</td><td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>{cellText(row["startDate"])}</td><td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>{cellText(row["endDate"])}</td><td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>{cellText(row["totalDays"])}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
