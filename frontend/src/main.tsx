import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { TakeoffSparProvider } from '@takeoff-ui/react-spar';
import { App } from './App';

// Global toast notification listener
window.addEventListener('app-toast', ((e: CustomEvent<{ type: string; message: string }>) => {
  const { type, message } = e.detail;
  const toast = document.createElement('div');
  const isError = type === 'error';
  const dismiss = () => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); };
  Object.assign(toast.style, {
    position: 'fixed', top: '20px', right: '20px', zIndex: '99999',
    padding: '12px 16px 12px 16px', borderRadius: '8px', fontSize: '13px', maxWidth: '420px',
    color: '#fff', background: isError ? '#d32f2f' : '#388e3c',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)', whiteSpace: 'pre-line',
    animation: 'toast-in 0.3s ease', display: 'flex', alignItems: 'flex-start', gap: '8px',
  });

  const msgEl = document.createElement('div');
  msgEl.textContent = message;
  msgEl.style.flex = '1';
  toast.appendChild(msgEl);

  const btnWrap = document.createElement('div');
  btnWrap.style.cssText = 'display:flex;gap:4px;flex-shrink:0;margin-top:-2px';

  const copyBtn = document.createElement('button');
  copyBtn.innerHTML = '⎘';
  copyBtn.title = 'Copy';
  copyBtn.style.cssText = 'background:rgba(255,255,255,0.2);border:none;color:#fff;cursor:pointer;border-radius:4px;padding:2px 6px;font-size:14px';
  copyBtn.onmouseenter = () => { copyBtn.style.background = 'rgba(255,255,255,0.35)'; };
  copyBtn.onmouseleave = () => { copyBtn.style.background = 'rgba(255,255,255,0.2)'; };
  copyBtn.onclick = () => { navigator.clipboard.writeText(message).then(() => { copyBtn.innerHTML = '✓'; setTimeout(() => { copyBtn.innerHTML = '⎘'; }, 1500); }); };
  btnWrap.appendChild(copyBtn);

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.title = 'Close';
  closeBtn.style.cssText = 'background:rgba(255,255,255,0.2);border:none;color:#fff;cursor:pointer;border-radius:4px;padding:2px 6px;font-size:14px';
  closeBtn.onmouseenter = () => { closeBtn.style.background = 'rgba(255,255,255,0.35)'; };
  closeBtn.onmouseleave = () => { closeBtn.style.background = 'rgba(255,255,255,0.2)'; };
  closeBtn.onclick = dismiss;
  btnWrap.appendChild(closeBtn);

  toast.appendChild(btnWrap);
  document.body.appendChild(toast);
  const autoClose = setTimeout(dismiss, 8000);
  toast.onmouseenter = () => clearTimeout(autoClose);
  toast.onmouseleave = () => setTimeout(dismiss, 3000);
}) as EventListener);

// Toast animation
const toastStyle = document.createElement('style');
toastStyle.textContent = '@keyframes toast-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }';
document.head.appendChild(toastStyle);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TakeoffSparProvider colorMode="light" locale="tr">
    <App />
    </TakeoffSparProvider>
  </React.StrictMode>
);
