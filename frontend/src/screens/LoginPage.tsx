import React, { useState } from 'react';
import { loginWithCredentials } from '../dataProvider';

interface LoginPageProps {
  onLogin: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [credential, setCredential] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const primaryColor = 'var(--primary-500)';
  const appName = "İzin Yönetimi";


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credential.trim() || !password.trim()) {
      setError('Please enter both kullanıcı adı veya e-posta and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const ok = await loginWithCredentials(credential, password);
      if (ok) {
        onLogin();
      } else {
        setError('Invalid kullanıcı adı veya e-posta or password');
      }
    } catch (err) {
      setError((err as Error).message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Left Panel */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, #1976d2 0%, #1976d2cc 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        padding: '60px 40px', color: '#fff',
      }}>
        <div style={{ maxWidth: 360, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 24 }}>
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.5px' }}>{appName}</h1>
          <p style={{ fontSize: 15, opacity: 0.85, lineHeight: 1.6, margin: 0 }}>
            Yönetim paneline güvenli erişim. Devam etmek için bilgilerinizle giriş yapın.
          </p>
          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center', gap: 32 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>256-bit</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>SSL Encryption</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        padding: '60px 40px', background: '#fafbfc',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', color: '#1a1a2e' }}>{"Giriş"}</h2>
          <p style={{ fontSize: 14, color: '#888', margin: '0 0 32px' }}>{"Devam etmek için bilgilerinizi girin"}</p>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 6 }}>Kullanıcı adı veya e-posta</label>
              <input
                type="text" value={credential}
                onChange={(e) => { setCredential(e.target.value); setError(''); }}
                placeholder="Kullanıcı adınız veya e-postanız" autoComplete="username"
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                onFocus={(e) => e.currentTarget.style.borderColor = primaryColor}
                onBlur={(e) => e.currentTarget.style.borderColor = '#ddd'}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 6 }}>{"Şifre"}</label>
              <input
                type="password" value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder={"Şifrenizi girin"} autoComplete="current-password"
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                onFocus={(e) => e.currentTarget.style.borderColor = primaryColor}
                onBlur={(e) => e.currentTarget.style.borderColor = '#ddd'}
              />
            </div>

            {error && (
              <div style={{ padding: '8px 12px', background: '#fff3f3', border: '1px solid #f5c6c6', borderRadius: 6, color: '#c62828', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '12px', border: 'none', borderRadius: 8,
                background: loading ? '#999' : primaryColor, color: '#fff', fontSize: 15, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 16,
              }}
            >
              {loading ? "Giriş yapılıyor…" : "Giriş yap"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};
