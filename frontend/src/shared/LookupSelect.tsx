import React, { useEffect, useState, useRef, useCallback } from 'react';
import { dataProvider } from '../dataProvider';

interface LookupSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** API resource to fetch options from — omit if using static options */
  resource?: string;
  /** Static options — used when no resource is provided */
  options?: Array<{ label: string; value: string }>;
  /** Which field to display as label — defaults to 'name' */
  displayField?: string;
  /** Which field to use as value — defaults to 'id' */
  valueField?: string;
  /** Enable search input (default: true for resource, false for static) */
  searchable?: boolean;
  /** Items per page (default: 10) */
  pageSize?: number;
  /** Search param name sent to API (default: 'Keyword') */
  searchParam?: string;
  /** Default filters to include in every API call */
  defaultFilter?: Record<string, string>;
}

type Option = { label: string; value: string };

const getDisplay = (item: Record<string, unknown>, field?: string): string => {
  if (field && item[field] != null) return String(item[field]);
  return String(
    item.name ?? item.title ?? item.fullName ?? item.displayName ?? item.code ?? item.label ??
    item.Name ?? item.Title ?? item.FullName ?? item.DisplayName ?? item.Code ?? item.Label ?? item.id ?? ''
  );
};

/**
 * Searchable select dropdown that loads options from an API resource.
 * Supports server-side search with debounce.
 */
export const LookupSelect: React.FC<LookupSelectProps> = ({
  label, value, onChange, resource, options: staticOptions,
  displayField, valueField = 'id', searchable, pageSize = 10, searchParam = 'Keyword', defaultFilter,
}) => {
  const isRemote = !!resource;
  const effectiveSearchable = searchable ?? isRemote;

  const [remoteOptions, setRemoteOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Stabilize defaultFilter — serialize to avoid new object ref on every render
  const filterKey = defaultFilter ? JSON.stringify(defaultFilter) : '';
  const stableFilter = useRef(defaultFilter);
  if (filterKey !== JSON.stringify(stableFilter.current)) stableFilter.current = defaultFilter;

  const allOptions = isRemote ? remoteOptions : (staticOptions ?? []);

  const fetchOptions = useCallback((keyword: string) => {
    if (!resource) return;
    setLoading(true);
    const filter: Record<string, unknown> = { ...(stableFilter.current ?? {}) };
    if (keyword) filter[searchParam] = keyword;
    dataProvider
      .list(resource, { pagination: { page: 1, perPage: pageSize }, filter })
      .then((res) => {
        const items = (res.data ?? []) as Record<string, unknown>[];
        setRemoteOptions(items.map((item) => ({
          label: getDisplay(item, displayField),
          value: String(item[valueField] ?? item.id ?? ''),
        })));
      })
      .catch(() => setRemoteOptions([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, displayField, valueField, pageSize, searchParam, filterKey]);

  const [dropPos, setDropPos] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = containerRef.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom;
      setDropPos(below < 240 && r.top > below
        ? { bottom: window.innerHeight - r.top + 4, left: r.left, width: r.width }
        : { top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [open]);

  // Initial load for remote — only once
  useEffect(() => {
    if (isRemote && !initializedRef.current) {
      initializedRef.current = true;
      fetchOptions('');
    }
  }, [fetchOptions, isRemote]);

  // Resolve selected label from current options
  useEffect(() => {
    if (!value) { setSelectedLabel(''); return; }
    const found = allOptions.find(o => o.value === String(value));
    if (found) { setSelectedLabel(found.label); }
  }, [value, allOptions]);

  // Debounced search for remote
  useEffect(() => {
    if (!effectiveSearchable || !isRemote) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchOptions(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, effectiveSearchable, isRemote, fetchOptions]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Client-side filter for static options
  const filteredOptions = !isRemote && search
    ? allOptions.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : allOptions;

  const handleSelect = (opt: Option) => {
    onChange(opt.value);
    setSelectedLabel(opt.label);
    setSearch('');
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSelectedLabel('');
    setSearch('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {label && (
        <div style={{ fontSize: 14, fontWeight: 400, color: '#222530', marginBottom: 6 }}>{label}</div>
      )}
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: '10px 14px',
          border: `1px solid ${open ? '#999' : '#ddd'}`,
          borderRadius: 8,
          fontSize: 14,
          cursor: 'pointer',
          background: '#fff',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          height: 48,
          boxSizing: 'border-box',
          transition: 'border-color 0.15s',
          color: selectedLabel ? '#333' : '#aaa',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLabel || 'Select…'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
          {value && (
            <span onClick={handleClear} style={{ color: '#aaa', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</span>
          )}
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}>
            <path d="M1 1L5 5L9 1" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </div>

      {open && (
        <div style={{
          // fixed: modal/kaydirma kabinin overflow'u listeyi kesmesin; alta yer yoksa uste acilir
          position: 'fixed', ...dropPos,
          background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1100,
          maxHeight: 220, display: 'flex', flexDirection: 'column',
        }}>
          {effectiveSearchable && (
            <div style={{ padding: '8px 8px 4px' }}>
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={"Ara…"}
                style={{
                  width: '100%', padding: '6px 10px', border: '1px solid #ddd',
                  borderRadius: 4, fontSize: 12, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {loading && (
              <div style={{ padding: '12px', fontSize: 12, color: '#999', textAlign: 'center' }}>Loading…</div>
            )}
            {!loading && filteredOptions.length === 0 && (
              <div style={{ padding: '12px', fontSize: 12, color: '#999', textAlign: 'center' }}>
                {search ? "Sonuç bulunamadı" : "Kayıt yok"}
              </div>
            )}
            {!loading && filteredOptions.map((opt) => (
              <div
                key={opt.value}
                onClick={() => handleSelect(opt)}
                style={{
                  padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                  background: opt.value === String(value) ? '#e3f2fd' : 'transparent',
                  color: opt.value === String(value) ? '#1976d2' : '#333',
                  fontWeight: opt.value === String(value) ? 600 : 400,
                }}
                onMouseEnter={(e) => { if (opt.value !== String(value)) (e.currentTarget).style.background = '#f5f5f5'; }}
                onMouseLeave={(e) => { if (opt.value !== String(value)) (e.currentTarget).style.background = 'transparent'; }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
