import React, { useEffect, useState } from 'react';
import { API_BASE } from '../config';
import { getAuthToken, setAuthToken } from '../dataProvider';

interface DemoUser { userName: string; displayName: string; roles: string[] }
const STEPS: string[] = ["Yönetici olarak yeni bir talep oluşturun","Kaydı açıp “Gönder” ile onaya gönderin","Rolü onaylayıcıya çevirin, Görevlerim’den onaylayın","Sonraki onay rolüne geçip son onayı verin, kaydın durumuna bakın"];
const ORIGIN_KEY = '_demo_origin_token';

const call = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${API_BASE}/api/TokenAuth/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
  });
  // ABP JsonResult'u { result: ... } ile bir kez daha sarar
  const d = res.ok ? await res.json() : null;
  return d?.result?.result !== undefined ? d.result : d;
};

export const DemoBar: React.FC = () => {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { call('GetDemoUsers').then((d) => setUsers(d?.result ?? [])).catch(() => {}); }, []);
  if (users.length === 0) return null;

  const current = localStorage.getItem('_user_name') || '';
  const ORIGIN = '__origin';
  const originName = localStorage.getItem(ORIGIN_KEY + '_name') || current || 'admin';
  const switchTo = async (userName: string) => {
    const d = await call('SwitchDemoUser', { method: 'POST', body: JSON.stringify({ userName }) });
    const token = d?.result?.accessToken;
    if (!token) return;
    if (!localStorage.getItem(ORIGIN_KEY)) {
      localStorage.setItem(ORIGIN_KEY, getAuthToken());
      localStorage.setItem(ORIGIN_KEY + '_name', current);
    }
    setAuthToken(token);
    localStorage.setItem('_user_name', userName);
    window.location.reload();
  };
  const backToOrigin = () => {
    const t = localStorage.getItem(ORIGIN_KEY);
    if (!t) return;
    setAuthToken(t);
    localStorage.setItem('_user_name', localStorage.getItem(ORIGIN_KEY + '_name') || 'admin');
    localStorage.removeItem(ORIGIN_KEY);
    localStorage.removeItem(ORIGIN_KEY + '_name');
    window.location.reload();
  };

  return (
    <div style={{ margin: '0 0 12px', padding: '8px 12px', border: '1px dashed #f0b429', background: '#fffbea', borderRadius: 8, fontSize: 13 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>Demo</strong>
        <label htmlFor="demo-role">Rol olarak gör:</label>
        <select id="demo-role" value={users.some((u) => u.userName === current) ? current : ORIGIN}
          onChange={(e) => (e.target.value === ORIGIN ? backToOrigin() : switchTo(e.target.value))}>
          {/* Giris yapilan hesap (admin) her zaman listede — demo rolunden geri donus buradan */}
          <option value={ORIGIN}>{originName} (giriş hesabı)</option>
          {users.map((u) => <option key={u.userName} value={u.userName}>{u.roles.join(', ') || u.displayName}</option>)}
        </select>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} style={{ marginLeft: 'auto' }}>İlk akışı dene</button>
      </div>
      {open && <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>{STEPS.map((s) => <li key={s}>{s}</li>)}</ol>}
    </div>
  );
};
