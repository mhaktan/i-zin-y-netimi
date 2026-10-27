import type { CSSProperties } from 'react';

export const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

export const modalStyle: CSSProperties = {
  background: '#fff', borderRadius: 12, width: 600,
  maxWidth: '95vw', maxHeight: '90vh',
  minHeight: 320, display: 'flex', flexDirection: 'column',
  boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden',
};

export const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' };

export const thStyle: CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 12,
  color: '#666', borderBottom: '2px solid #e0e0e0', whiteSpace: 'nowrap',
};

export const tdStyle: CSSProperties = {
  padding: '10px 14px', borderBottom: '1px solid #f0f0f0',
  fontSize: 13, verticalAlign: 'middle',
};
