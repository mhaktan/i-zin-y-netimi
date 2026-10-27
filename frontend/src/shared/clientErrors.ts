import { API_BASE } from '../config';
import { authFetch, getAuthToken } from '../dataProvider';

let sent: number[] = [];
const report = (message: string, stack?: string) => {
  if (!getAuthToken()) return;
  const now = Date.now();
  sent = sent.filter((t) => now - t < 60_000);
  if (sent.length >= 20) return;
  sent.push(now);
  void authFetch(`${API_BASE}/api/services/app/ClientLog/Write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: String(message).slice(0, 2000), stack: (stack ?? '').slice(0, 4000), url: window.location.pathname }),
  }).catch(() => { /* log iletilemezse sessiz */ });
};

window.addEventListener('error', (e) => report(e.message, e.error?.stack));
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason as { message?: string; stack?: string } | undefined;
  report(r?.message ?? String(e.reason), r?.stack);
});
