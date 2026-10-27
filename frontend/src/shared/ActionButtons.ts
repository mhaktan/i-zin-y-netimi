// ---------------------------------------------------------------------------
// Action button renderers for TkTable html columns.
// TkTable only supports string-based html rendering, so these return HTML strings.
// Override the styles/labels here to change all tables globally.
// ---------------------------------------------------------------------------

export interface ActionButtonsConfig {
  edit?: {
    label?: string;
    style?: string;
  };
  delete?: {
    label?: string;
    style?: string;
  };
}

const DEFAULT_CONFIG: Required<ActionButtonsConfig> = {
  edit: {
    label: "Düzenle",
    style: 'background:#e3f2fd;color:#1976d2;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600',
  },
  delete: {
    label: "Sil",
    style: 'background:#ffebee;color:#c62828;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600',
  },
};

/**
 * Registers a global click handler for CRUD action buttons.
 * Call this in useEffect and pass your action handler.
 */
export const registerCrudHandler = (
  handler: (action: string, id: string) => void,
): (() => void) => {
  (window as unknown as Record<string, unknown>).__crud_action__ = (action: string, id: string) => handler(action, decodeURIComponent(id));
  return () => { delete (window as unknown as Record<string, unknown>).__crud_action__; };
};

/**
 * Returns an html column definition for edit/delete action buttons.
 * Pass to your COLUMNS array: `...actionColumn('id', { hasEdit: true, hasDelete: true })`
 */
export const actionColumn = (
  idField: string,
  options: { hasEdit?: boolean; hasDelete?: boolean; pdfLabel?: string; config?: ActionButtonsConfig },
) => {
  const { hasEdit, hasDelete, pdfLabel, config } = options;
  if (!hasEdit && !hasDelete && !pdfLabel) return [];

  const editCfg = { ...DEFAULT_CONFIG.edit, ...config?.edit };
  const deleteCfg = { ...DEFAULT_CONFIG.delete, ...config?.delete };

  const html = (row: Record<string, unknown>) => {
    // id HTML onclick icine gomulur: kodlanmazsa metin id'ler (GUID disi) script calistirabilir
    const id = encodeURIComponent(String(row[idField] ?? '')).replace(/'/g, '%27');
    const parts: string[] = [];
    if (hasEdit) {
      parts.push(`<button onclick="window.__crud_action__('edit','${id}')" style="${editCfg.style}">${editCfg.label}</button>`);
    }
    if (hasDelete) {
      parts.push(`<button onclick="window.__crud_action__('delete','${id}')" style="${deleteCfg.style}">${deleteCfg.label}</button>`);
    }
    if (pdfLabel) {
      parts.push(`<button onclick="window.__crud_action__('pdf','${id}')" style="${editCfg.style}">${pdfLabel}</button>`);
    }
    return `<div style="display:flex;gap:6px;justify-content:flex-end">${parts.join('')}</div>`;
  };

  return [{ field: '__actions', header: "İşlemler", html }];
};
