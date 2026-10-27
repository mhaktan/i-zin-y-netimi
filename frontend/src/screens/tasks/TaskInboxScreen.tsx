import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '../../dataProvider';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

// entityType -> App.tsx route adi (App.tsx ile ayni kaynaktan uretilir)
const ENTITY_ROUTES: Record<string, string> = {
  "leaverequest": "LeaveRequest",
  "leavebalance": "LeaveBalance"
};
const ENTITY_LABELS: Record<string, string> = {"leaverequest":"İzin Talebi","leavebalance":"İzin Bakiyesi"};

const routeForTask = (entityType: string): string | null => {
  const name = ENTITY_ROUTES[(entityType || '').toLowerCase()];
  return name ? '/' + name : null;
};
const labelFor = (entityType: string) => ENTITY_LABELS[(entityType || '').toLowerCase()] ?? entityType;

const ACTION_LABELS: Record<string, string> = { Approve: "Onayla", Revise: "Revizeye gönder", Reject: "Reddet" };
const isNegative = (a: string) => a === 'Revise' || a === 'Reject';

// Suresi dolan oturum: giris ekranina
const handle401 = (status: number): boolean => {
  if (status !== 401) return false;
  ['_auth_token', '_bearer_token', '_refresh_token'].forEach(k => localStorage.removeItem(k));
  if (window.location.pathname !== '/login') window.location.href = '/login';
  return true;
};

interface PendingTask {
  approvalRecordId: string;
  entityType: string;
  entityId: string;
  stepName: string;
  creationTime: string;
  availableActions: string[];
  formNo?: string;
  description?: string;
  creatorName?: string;
}

/** ABP hata zarfindan okunabilir mesaji cikarir. */
const parseApiError = (e: unknown): string => {
  const raw = e instanceof Error ? e.message : String(e);
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || parsed?.error?.details || raw;
  } catch { return raw; }
};

const timeAgo = (dateStr: string) => {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return mins + ' ' + "dk önce";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' ' + "saat önce";
  return Math.floor(hours / 24) + ' ' + "gün önce";
};

const btn = (kind: 'primary' | 'danger' | 'ghost'): React.CSSProperties => ({
  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: kind === 'primary' ? '1px solid #2e7d32' : kind === 'danger' ? '1px solid #e57373' : '1px solid transparent',
  background: kind === 'primary' ? '#2e7d32' : '#fff',
  color: kind === 'primary' ? '#fff' : kind === 'danger' ? '#c62828' : '#1976d2',
});

export default function TaskInboxScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [modal, setModal] = React.useState<{ task: PendingTask; action: string } | null>(null);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const noticeTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: tasks = [], isLoading } = useQuery<PendingTask[]>({
    queryKey: ['pending-tasks'],
    queryFn: async () => {
      const res = await authFetch(API_BASE + '/api/services/app/Approval/GetMyPendingApprovals');
      if (handle401(res.status)) return [];
      if (!res.ok) return [];
      const json = await res.json();
      return json.result ?? json;
    },
    refetchInterval: 30000,
  });

  const process = useMutation({
    mutationFn: async (p: { approvalRecordId: string; action: string; comment?: string }) => {
      const res = await authFetch(API_BASE + '/api/services/app/Approval/ProcessApproval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      if (handle401(res.status)) throw new Error('Unauthorized');
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['pending-tasks'] });
      setModal(null); setComment(''); setError('');
      setNotice((ACTION_LABELS[v.action] ?? v.action) + ' — ' + "İşlem tamamlandı");
      clearTimeout(noticeTimer.current); // art arda islemde onceki zamanlayici yeni bildirimi silmesin
      noticeTimer.current = setTimeout(() => setNotice(''), 3000);
    },
    // Onay islemi sessizce basarisiz olmamali: durum degismezse kullanici nedenini gormeli.
    onError: (e: unknown) => setError(parseApiError(e)),
  });

  React.useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setModal(null); setComment(''); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  const filtered = tasks.filter(t => {
    if (!filter) return true;
    const q = filter.toLocaleLowerCase();
    return labelFor(t.entityType).toLocaleLowerCase().includes(q) || t.stepName.toLocaleLowerCase().includes(q) ||
      (t.creatorName?.toLocaleLowerCase().includes(q) ?? false) || (t.formNo?.toLocaleLowerCase().includes(q) ?? false) || t.entityId.includes(q);
  });

  const handleAction = (task: PendingTask, action: string) => {
    setError('');
    if (isNegative(action)) setModal({ task, action });
    else process.mutate({ approvalRecordId: task.approvalRecordId, action });
  };
  const openRecord = (task: PendingTask) => {
    const route = routeForTask(task.entityType);
    if (route) navigate(route + '?focus=' + encodeURIComponent(task.entityId));
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Görevlerim</h1>
            {tasks.length > 0 && (
              <span style={{ background: '#1976d2', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 13, fontWeight: 600 }}>{tasks.length}</span>
            )}
          </div>
          <div style={{ fontSize: 13, color: '#777', marginTop: 4 }}>Onayınızı bekleyen kayıtlar</div>
        </div>
        <input
          aria-label={"Görevlerde ara…"}
          placeholder={"Görevlerde ara…"}
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, width: 260 }}
        />
      </div>

      {error && (
        <div role="alert" style={{ padding: '10px 14px', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 8, color: '#c62828', fontSize: 13, marginBottom: 12 }}>{error}</div>
      )}
      {notice && (
        <div role="status" style={{ padding: '10px 14px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, color: '#1b5e20', fontSize: 13, marginBottom: 12 }}>{notice}</div>
      )}

      {isLoading && <p style={{ color: '#888' }}>Yükleniyor…</p>}

      {!isLoading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '56px 24px', color: '#888', background: '#fff', border: '1px dashed #dde3ea', borderRadius: 12 }}>
          <div style={{ fontSize: 34, marginBottom: 8, color: '#4caf50' }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>Bekleyen göreviniz yok</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Size gelen onay talepleri burada görünür.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(task => (
          <div key={task.approvalRecordId} style={{
            padding: 16, background: '#fff', border: '1px solid #e6eaef', borderLeft: '4px solid #1976d2', borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: '#e3f2fd', color: '#1565c0', fontWeight: 600 }}>{labelFor(task.entityType)}</span>
                <span style={{ fontSize: 12, color: '#999' }}>{task.formNo || '#' + task.entityId}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#222' }}>{task.stepName}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                {task.creatorName ? "Talep eden" + ': ' + task.creatorName + ' · ' : ''}{timeAgo(task.creationTime)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {routeForTask(task.entityType) && (
                <button type="button" onClick={() => openRecord(task)} style={btn('ghost')}>Kaydı aç</button>
              )}
              {[...task.availableActions].sort((a, b) => Number(!isNegative(a)) - Number(!isNegative(b))).map(a => (
                <button type="button" key={a} onClick={() => handleAction(task, a)} disabled={process.isPending}
                  style={btn(isNegative(a) ? 'danger' : 'primary')}>
                  {ACTION_LABELS[a] ?? a}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div onClick={() => { setModal(null); setComment(''); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="task-modal-title" onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 id="task-modal-title" style={{ margin: '0 0 4px', fontSize: 18 }}>{ACTION_LABELS[modal.action] ?? modal.action} — {modal.task.stepName}</h3>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>{labelFor(modal.task.entityType)} {modal.task.formNo || '#' + modal.task.entityId}</div>
            <label htmlFor="task-reason" style={{ fontSize: 13, fontWeight: 600 }}>Gerekçe *</label>
            <textarea id="task-reason" autoFocus value={comment} onChange={e => setComment(e.target.value)}
              style={{ width: '100%', minHeight: 90, padding: 10, marginTop: 6, borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Talep sahibi bu notu görecek.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" onClick={() => { setModal(null); setComment(''); }} style={{ ...btn('ghost'), color: '#555', border: '1px solid #ddd' }}>Vazgeç</button>
              <button type="button" onClick={() => process.mutate({ approvalRecordId: modal.task.approvalRecordId, action: modal.action, comment })}
                disabled={!comment.trim() || process.isPending}
                style={{ ...btn('primary'), background: '#c62828', borderColor: '#c62828', opacity: !comment.trim() || process.isPending ? 0.5 : 1 }}>
                {ACTION_LABELS[modal.action] ?? modal.action}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
