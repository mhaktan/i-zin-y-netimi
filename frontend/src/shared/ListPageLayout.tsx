import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Table, Input, Select, Button, type TableColumnDef, type TableDataRequest } from '@takeoff-ui/react-spar';
import { registerCrudHandler } from './ActionButtons';

// Re-export column type so screens can import from one place
export interface TableColumn {
  field: string;
  header: string;
  width?: string;
  sortable?: boolean;
  searchable?: boolean;
  filterType?: 'text' | 'checkbox' | 'radio' | 'datepicker';
  filterOptions?: Array<{ label: string; value: string | number }>;
  html?: (row: Record<string, unknown>) => string;
}

interface ListPageLayoutProps {
  title: string;
  subtitle?: React.ReactNode;
  records: Record<string, unknown>[];
  columns: TableColumn[];
  dataKey: string;
  total: number;
  loading?: boolean;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  onTableRequest: (e: CustomEvent) => void;
  selectionMode?: 'checkbox';
  selectedRows?: Record<string, unknown>[];
  onSelectionChange?: (rows: Record<string, unknown>[]) => void;
  headerActions?: React.ReactNode;
  onCrudAction?: (action: string, id: string) => void;
}

type Row = Record<string, unknown>;

export const ListPageLayout: React.FC<ListPageLayoutProps> = ({
  title, subtitle, records, columns, dataKey,
  total, loading, page, perPage,
  onPageChange, onPerPageChange, onTableRequest,
  selectionMode, selectedRows, onSelectionChange,
  headerActions, onCrudAction,
}) => {
  // CRUD action buttons rendered via column.html use window.__crud_action__
  useEffect(() => {
    if (!onCrudAction) return;
    return registerCrudHandler(onCrudAction);
  }, [onCrudAction]);

  // v2 Table sunucu modu: sayfa, sayfa boyutu ve siralama tek istekte gelir —
  // degisen parcayi ListPageLayout sozlesmesine (onPageChange / onTableRequest) cevir.
  const lastSort = useRef('');
  const handleDataRequest = (r: TableDataRequest) => {
    if (r.pagination.pageSize !== perPage) { onPerPageChange(r.pagination.pageSize); onPageChange(1); return; }
    if (r.pagination.pageIndex + 1 !== page) onPageChange(r.pagination.pageIndex + 1);
    const sortKey = JSON.stringify(r.sorting);
    if (sortKey !== lastSort.current) {
      lastSort.current = sortKey;
      const sorts = r.sorting.map((s) => ({ field: s.id, order: s.desc ? 'desc' : 'asc' }));
      onTableRequest(new CustomEvent('tk-request', { detail: { sorts } }));
    }
  };

  // Kolon filtreleri — her degisiklikte TUM aktif filtre seti gonderilir (Material ile ayni sozlesme)
  const [filterState, setFilterState] = useState<Record<string, string>>({});
  const filterableCols = columns.filter((c) => c.searchable || c.filterType);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dispatchFilters = (state: Record<string, string>) => {
    const filters = filterableCols
      .map((c) => ({ field: c.field, value: state[c.field] ?? '', type: c.filterType ?? 'text' }))
      .filter((f) => f.value !== '' && f.value != null);
    onTableRequest(new CustomEvent('tk-request', { detail: { filters } }));
    onPageChange(1);
  };
  const setColFilter = (field: string, value: string, debounce: boolean) => {
    const next = { ...filterState, [field]: value };
    setFilterState(next);
    if (debounce) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => dispatchFilters(next), 400);
    } else dispatchFilters(next);
  };
  const hasActiveFilters = Object.values(filterState).some((v) => v !== '' && v != null);

  const tableColumns = useMemo<TableColumnDef<Row>[]>(() => columns.map((c) => ({
    id: c.field,
    header: c.header,
    // accessor olmadan TanStack kolonu siralanabilir saymaz
    accessor: c.field,
    sortable: !!c.sortable,
    ...(c.width ? { width: parseInt(c.width, 10) || undefined } : {}),
    cell: ({ row }) => c.html
      ? <span dangerouslySetInnerHTML={{ __html: c.html(row.original) }} />
      : String(row.original[c.field] ?? ''),
  })), [columns]);

  const selectionValue = useMemo(() => Object.fromEntries((selectedRows ?? []).map((r) => [String(r[dataKey]), true])), [selectedRows, dataKey]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{title}</h1>
          {subtitle}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>{headerActions}</div>
      </div>

      {filterableCols.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
          {filterableCols.map((col) => {
            const v = filterState[col.field] ?? '';
            return (
              <div key={col.field} style={{ display: 'flex', flexDirection: 'column', minWidth: 170 }}>
                <span style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>{col.header}</span>
                {col.filterOptions && col.filterOptions.length > 0 ? (
                  <Select value={v || undefined} onChange={(nv) => setColFilter(col.field, nv == null ? '' : String(nv), false)} size="small">
                    <Select.Trigger placeholder="Tümü" />
                    <Select.Content>
                      {col.filterOptions.map((o) => <Select.Item key={String(o.value)} value={String(o.value)}>{o.label}</Select.Item>)}
                    </Select.Content>
                  </Select>
                ) : (
                  <Input size="small">
                    <Input.Field
                      type={col.filterType === 'datepicker' ? 'date' : 'text'}
                      placeholder="Filtre…"
                      value={v}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColFilter(col.field, e.target.value, col.filterType !== 'datepicker')}
                    />
                  </Input>
                )}
              </div>
            );
          })}
          {hasActiveFilters && (
            <Button appearance="text" size="small" onClick={() => { setFilterState({}); dispatchFilters({}); }}>Temizle</Button>
          )}
        </div>
      )}

      <Table<Row>
        data={records}
        columns={tableColumns}
        getRowId={(row, i) => String(row[dataKey] ?? i)}
        manual
        loading={loading}
        striped
        size="small"
        pagination={{ pageIndex: page - 1, pageSize: perPage, rowCount: total, pageSizeOptions: [10, 20, 50, 100] }}
        onDataRequest={handleDataRequest}
        {...(selectionMode ? {
          selection: {
            mode: 'multiple' as const,
            value: selectionValue,
            onChange: (sel: Record<string, boolean>) => onSelectionChange?.(records.filter((r) => sel[String(r[dataKey])])),
          },
        } : {})}
        emptyState="Kayıt yok"
        // Kutuphanenin sayfa bilgisi Ingilizce ("Page 1 of 1") — gizlenip asagida Turkcesi yazilir;
        // kolon basliklari kisaltilmaz ("Planned Amo…" yerine tam baslik, gerekirse yatay kaydirma)
        slotProps={{ paginationInfo: { style: { display: 'none' } }, headerContent: { style: { whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' } } }}
      />
      {total > 0 && (
        <div aria-live="polite" style={{ fontSize: 12, color: '#777', marginTop: 6 }}>
          Sayfa {page} / {Math.max(1, Math.ceil(total / perPage))} · {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} / {total} kayıt
        </div>
      )}
    </div>
  );
};
