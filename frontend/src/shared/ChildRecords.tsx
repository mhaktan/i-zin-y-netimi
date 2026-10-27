import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dataProvider } from '../dataProvider';
import { formatDate } from './format';

interface Props {
  resource: string;
  label: string;
  fk: string;
  parentId: string | number;
  columns: Array<{ field: string; label: string; type: string }>;
}

const cell = (v: unknown, type: string): string =>
  v == null || v === '' ? '—'
    : type === 'date' || type === 'datetime' ? formatDate(v, type === 'datetime')
    : typeof v === 'boolean' ? (v ? "Evet" : "Hayır")
    : type === 'currency' ? Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2 })
    : String(v);

export const ChildRecords: React.FC<Props> = ({ resource, label, fk, parentId, columns }) => {
  const { data, isLoading } = useQuery({
    queryKey: [resource, 'children', fk, parentId],
    queryFn: () => dataProvider.list<Record<string, unknown>>(resource, { pagination: { page: 1, perPage: 5 }, filter: { [fk]: String(parentId) } }),
  });
  const rows = data?.data ?? [];
  const total = data?.total ?? rows.length;
  const href = `/${resource}?${encodeURIComponent(fk)}=${encodeURIComponent(String(parentId))}`;
  return (
    <section style={{ gridColumn: '1 / -1', marginTop: 8, border: '1px solid #eee', borderRadius: 8, padding: 12 }} aria-label={label}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>{label} ({total})</strong>
        <Link to={href} style={{ fontSize: 13, color: '#1976d2', fontWeight: 600, textDecoration: 'none' }}>Tümünü yönet / ekle →</Link>
      </div>
      {isLoading ? <div style={{ fontSize: 13, color: '#999' }}>{"Yükleniyor…"}</div>
        : rows.length === 0 ? <div style={{ fontSize: 13, color: '#999' }}>{"Kayıt yok"}</div>
        : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>{columns.map((c) => <th key={c.field} style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, borderBottom: '1px solid #eee' }}>{c.label}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={String(r.id ?? i)}>{columns.map((c) => <td key={c.field} style={{ padding: '4px 6px', borderBottom: '1px solid #f5f5f5' }}>{cell(r[c.field], c.type)}</td>)}</tr>
            ))}</tbody>
          </table>
        )}
    </section>
  );
};
