import React from 'react';
import { API_BASE } from '../config';
import { authFetch } from '../dataProvider';
import { formatDate } from '../shared/format';

const T = {"title":"Sistem Logları","subtitle":"Uyarı ve hatalar (yalnız yönetici)","level":"Seviye","all":"Tümü","search":"Mesaj veya yolda ara…","from":"Başlangıç","to":"Bitiş","time":"Zaman","message":"Mesaj","user":"Kullanıcı","path":"Yol","empty":"Kayıt yok","retention":"Saklama süresi (gün)","retentionHint":"Bu süreden eski loglar günde bir silinir.","save":"Kaydet","saved":"Kaydedildi","prev":"Önceki","next":"Sonraki","denied":"Bu ekranı yalnız yönetici görebilir."};
interface LogRow { id: number; time: string; level: string; message: string; exception?: string; source?: string; userName?: string; path?: string; requestId?: string }
const PAGE = 50;
const levelColor: Record<string, string> = { Warning: '#e65100', Error: '#c62828', Fatal: '#880e4f' };

const api = async (path: string, init?: RequestInit) => {
  const res = await authFetch(`${API_BASE}/api/services/app/SystemLog/${path}`, init);
  if (res.status === 401 || res.status === 403) throw new Error(T.denied);
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.error?.message ?? res.statusText);
  return j?.result ?? j;
};

export default function SystemLogsScreen() {
  const [rows, setRows] = React.useState<LogRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(0);
  const [level, setLevel] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [open, setOpen] = React.useState<number | null>(null);
  const [error, setError] = React.useState('');
  const [days, setDays] = React.useState('');
  const [saved, setSaved] = React.useState('');

  const load = React.useCallback(async () => {
    try {
      const q = new URLSearchParams({ SkipCount: String(page * PAGE), MaxResultCount: String(PAGE) });
      if (level) q.set('Level', level);
      if (search.trim()) q.set('Search', search.trim());
      if (from) q.set('From', from);
      if (to) q.set('To', to);
      const r = await api('GetLogs?' + q.toString());
      setRows(r.items ?? []); setTotal(r.totalCount ?? 0); setError('');
    } catch (e) { setError((e as Error).message); }
  }, [page, level, search, from, to]);

  React.useEffect(() => { const t = setTimeout(() => void load(), 300); return () => clearTimeout(t); }, [load]);
  React.useEffect(() => { api('GetSettings').then((s) => setDays(String(s.retentionDays))).catch(() => {}); }, []);

  const saveDays = async () => {
    try {
      const s = await api('SetRetentionDays?days=' + encodeURIComponent(days), { method: 'POST' });
      setDays(String(s.retentionDays)); setSaved(T.saved); setTimeout(() => setSaved(''), 2000);
    } catch (e) { setError((e as Error).message); }
  };

  const input: React.CSSProperties = { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 };
  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{T.title}</h1>
      <div style={{ fontSize: 13, color: '#777', margin: '4px 0 16px' }}>{T.subtitle}</div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12, padding: 12, background: '#fff', border: '1px solid #e6eaef', borderRadius: 10 }}>
        <label style={{ fontSize: 12, color: '#555', display: 'flex', flexDirection: 'column', gap: 4 }}>{T.level}
          <select value={level} onChange={(e) => { setPage(0); setLevel(e.target.value); }} style={input}>
            <option value="">{T.all}</option><option>Warning</option><option>Error</option><option>Fatal</option>
          </select>
        </label>
        <label style={{ fontSize: 12, color: '#555', display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>{T.search}
          <input value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} style={input} />
        </label>
        <label style={{ fontSize: 12, color: '#555', display: 'flex', flexDirection: 'column', gap: 4 }}>{T.from}
          <input type="date" value={from} onChange={(e) => { setPage(0); setFrom(e.target.value); }} style={input} />
        </label>
        <label style={{ fontSize: 12, color: '#555', display: 'flex', flexDirection: 'column', gap: 4 }}>{T.to}
          <input type="date" value={to} onChange={(e) => { setPage(0); setTo(e.target.value); }} style={input} />
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'flex-end' }} title={T.retentionHint}>
          <label style={{ fontSize: 12, color: '#555', display: 'flex', flexDirection: 'column', gap: 4 }}>{T.retention}
            <input type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} style={{ ...input, width: 90 }} />
          </label>
          <button type="button" onClick={() => void saveDays()} style={{ ...input, background: '#1976d2', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>{T.save}</button>
          {saved && <span role="status" style={{ fontSize: 12, color: '#2e7d32' }}>{saved}</span>}
        </div>
      </div>

      {error && <div role="alert" style={{ padding: '10px 14px', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 8, color: '#c62828', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ background: '#fff', border: '1px solid #e6eaef', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: '#fafafa', textAlign: 'left' }}>
            {[T.time, T.level, T.message, T.user, T.path].map((h) => <th key={h} style={{ padding: '10px 12px', fontWeight: 600, color: '#555', borderBottom: '1px solid #eee' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#999' }}>{T.empty}</td></tr>}
            {rows.map((r) => (
              <React.Fragment key={r.id}>
                <tr onClick={() => setOpen(open === r.id ? null : r.id)} style={{ cursor: 'pointer', borderBottom: '1px solid #f3f3f3' }}>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: '#666' }}>{formatDate(r.time, true)}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: levelColor[r.level] ?? '#555' }}>{r.level}</td>
                  <td style={{ padding: '8px 12px', maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.message}</td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{r.userName ?? '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#666', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.path ?? '—'}</td>
                </tr>
                {open === r.id && (
                  <tr><td colSpan={5} style={{ padding: '8px 12px 14px', background: '#fafbfc' }}>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{r.source}{r.requestId ? ' · ' + r.requestId : ''}</div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 320, overflow: 'auto' }}>{r.message}{r.exception ? '\n\n' + r.exception : ''}</pre>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', marginTop: 10, fontSize: 13 }}>
        <span style={{ color: '#777' }}>{total === 0 ? 0 : page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} / {total}</span>
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} style={input}>{T.prev}</button>
        <button type="button" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)} style={input}>{T.next}</button>
      </div>
    </div>
  );
}
