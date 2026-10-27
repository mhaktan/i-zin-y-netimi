import { useCallback, useState } from 'react';
import { jsPDF } from 'jspdf';
import { registerPdfFont, PDF_FONT } from './pdfFont';
import { API_BASE } from '../config';
import * as dataProviderModule from '../dataProvider';

interface PdfElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  props: Record<string, unknown>;
}

interface PdfHFConfig {
  enabled: boolean;
  height: number;
  logoUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
  logoAlign?: 'left' | 'center' | 'right';
  text?: string;
  textAlign?: 'left' | 'center' | 'right';
  fontSize?: number;
  color?: string;
}

interface PdfPageNumConfig {
  enabled: boolean;
  position: string;
  format?: string;
  fontSize?: number;
  color?: string;
}

interface PdfTemplate {
  id: string;
  name: string;
  orientation: 'portrait' | 'landscape';
  pageSize: 'a4' | 'a3' | 'letter';
  elements: PdfElement[];
  apiBinding?: {
    method: 'GET' | 'POST';
    url: string;
    headers?: Record<string, string>;
    body?: string;
    params?: Array<{ name: string; defaultValue?: string }>;
  };
  headerConfig?: PdfHFConfig;
  footerConfig?: PdfHFConfig;
  pageNumberConfig?: PdfPageNumConfig;
  contentMarginTop?: number;
  contentMarginBottom?: number;
}

const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  a3: { width: 297, height: 420 },
  letter: { width: 216, height: 279 },
};

function resolveFieldPath(data: unknown, path: string): unknown {
  const direct = resolvePath(data, path);
  // ABP yanitlari {result: ...} ile sarili — binding sarmalsiz yazilmissa result altinda dene
  if (direct === undefined && data && typeof data === 'object' && 'result' in (data as object)) {
    return resolvePath((data as Record<string, unknown>).result, path);
  }
  return direct;
}

function resolvePath(data: unknown, path: string): unknown {
  if (!path || data == null) return undefined;
  const parts = path.replace(/\[\]/g, '.0').split('.');
  let current: unknown = data;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

interface PageContext {
  contentTop: number;
  contentBottom: number;
  pageWidth: number;
  pageHeight: number;
  headerConfig?: PdfHFConfig;
  footerConfig?: PdfHFConfig;
  pageNumConfig?: PdfPageNumConfig;
  currentPage: number;
  totalPages: number;
}

function renderElement(doc: jsPDF, el: PdfElement, data?: unknown, pageCtx?: PageContext): void {
  const color = (el.props.color as string) ?? '#000000';
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const binding = el.props.binding as string | undefined;
  const text = binding && data
    ? String(resolveFieldPath(data, binding) ?? '')
    : (el.props.text as string) ?? '';

  switch (el.type) {
    case 'header':
      doc.setFont(PDF_FONT, 'bold');
      doc.setFontSize((el.props.fontSize as number) ?? 18);
      doc.setTextColor(r, g, b);
      doc.text(text, el.x, el.y + ((el.props.fontSize as number) ?? 18) * 0.35);
      break;
    case 'textbox':
    case 'textarea':
      doc.setFont(PDF_FONT, (el.props.fontWeight as string) === 'bold' ? 'bold' : 'normal');
      doc.setFontSize((el.props.fontSize as number) ?? 12);
      doc.setTextColor(r, g, b);
      doc.text(doc.splitTextToSize(text, el.width), el.x, el.y + ((el.props.fontSize as number) ?? 12) * 0.35);
      break;
    case 'section': {
      doc.setFont(PDF_FONT, 'bold');
      doc.setFontSize((el.props.fontSize as number) ?? 14);
      doc.setTextColor(r, g, b);
      doc.text(text, el.x, el.y + ((el.props.fontSize as number) ?? 14) * 0.35);
      const lc = (el.props.lineColor as string) ?? '#999999';
      doc.setDrawColor(parseInt(lc.slice(1, 3), 16), parseInt(lc.slice(3, 5), 16), parseInt(lc.slice(5, 7), 16));
      doc.setLineWidth(0.3);
      doc.line(el.x, el.y + el.height * 0.8, el.x + el.width, el.y + el.height * 0.8);
      break;
    }
    case 'divider': {
      const lc = (el.props.lineColor as string) ?? '#999999';
      doc.setDrawColor(parseInt(lc.slice(1, 3), 16), parseInt(lc.slice(3, 5), 16), parseInt(lc.slice(5, 7), 16));
      doc.setLineWidth(0.4);
      doc.line(el.x, el.y + el.height / 2, el.x + el.width, el.y + el.height / 2);
      break;
    }
    case 'vertical-divider': {
      const lc = (el.props.lineColor as string) ?? '#999999';
      doc.setDrawColor(parseInt(lc.slice(1, 3), 16), parseInt(lc.slice(3, 5), 16), parseInt(lc.slice(5, 7), 16));
      doc.setLineWidth(0.4);
      doc.line(el.x + el.width / 2, el.y, el.x + el.width / 2, el.y + el.height);
      break;
    }
    case 'checkbox': {
      const checked = binding && data ? !!resolveFieldPath(data, binding) : !!(el.props.checked);
      const bs = Math.min(el.height * 0.8, 4);
      const by = el.y + (el.height - bs) / 2;
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.3);
      doc.rect(el.x, by, bs, bs);
      if (checked) {
        doc.setDrawColor(r, g, b);
        doc.setLineWidth(0.5);
        doc.line(el.x + 0.8, by + bs * 0.5, el.x + bs * 0.4, by + bs * 0.8);
        doc.line(el.x + bs * 0.4, by + bs * 0.8, el.x + bs - 0.5, by + 0.8);
      }
      doc.setFont(PDF_FONT, (el.props.fontWeight as string) === 'bold' ? 'bold' : 'normal');
      doc.setFontSize((el.props.fontSize as number) ?? 12);
      doc.setTextColor(r, g, b);
      doc.text(text, el.x + bs + 2, el.y + ((el.props.fontSize as number) ?? 12) * 0.35);
      break;
    }
    case 'icon':
      doc.setFontSize((el.props.fontSize as number) ?? 14);
      doc.setTextColor(r, g, b);
      doc.text((el.props.iconName as string) ?? '*', el.x + el.width / 2, el.y + el.height / 2, { align: 'center' });
      break;
    case 'table': {
      // Designer {key,label}, eski sablonlar {field,header} yaziyor
      const columns = ((el.props.columns as Array<{ field?: string; header?: string; key?: string; label?: string; width?: number }>) ?? [])
        .map(c => ({ field: c.field ?? c.key ?? '', header: c.header ?? c.label ?? '', width: c.width }));
      if (columns.length === 0) break;

      // Extract data array from API response
      let rows: Record<string, unknown>[] = [];
      const bound = binding && data ? resolveFieldPath(data, binding) : undefined;
      if (Array.isArray(bound)) rows = bound as Record<string, unknown>[];
      else if (data) {
        if (Array.isArray(data)) rows = data;
        else if (typeof data === 'object') {
          const obj = data as Record<string, unknown>;
          for (const key of ['result.items', 'result', 'data', 'items', 'records', 'rows', 'list']) {
            const val = resolveFieldPath(obj, key);
            if (Array.isArray(val)) { rows = val as Record<string, unknown>[]; break; }
          }
          if (rows.length === 0 && Array.isArray(Object.values(obj)[0])) rows = Object.values(obj)[0] as Record<string, unknown>[];
        }
      }

      const fontSize = (el.props.fontSize as number) ?? 8;
      const headerFontSize = (el.props.headerFontSize as number) ?? 9;
      const lineHeight = fontSize * 0.4; // mm per line approx
      const cellPad = 2;
      const tableX = el.x;
      let tableY = el.y;
      const tableWidth = el.width;
      const colWidth = columns.map(c => c.width ?? tableWidth / columns.length);

      // Helper: calculate row height based on content
      const calcRowHeight = (texts: string[], fs: number): number => {
        doc.setFontSize(fs);
        let maxLines = 1;
        for (let i = 0; i < texts.length; i++) {
          const lines = doc.splitTextToSize(texts[i], colWidth[i] - cellPad * 2);
          if (lines.length > maxLines) maxLines = lines.length;
        }
        return Math.max(maxLines * (fs * 0.4) + cellPad * 2, 7);
      };

      // Header row
      const headerTexts = columns.map(c => c.header);
      const headerHeight = calcRowHeight(headerTexts, headerFontSize);
      doc.setFillColor(240, 240, 240);
      doc.rect(tableX, tableY, tableWidth, headerHeight, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.rect(tableX, tableY, tableWidth, headerHeight);
      doc.setFont(PDF_FONT, 'bold');
      doc.setFontSize(headerFontSize);
      doc.setTextColor(51, 51, 51);
      let cx = tableX;
      for (let i = 0; i < columns.length; i++) {
        doc.text(doc.splitTextToSize(headerTexts[i], colWidth[i] - cellPad * 2), cx + cellPad, tableY + cellPad + headerFontSize * 0.35);
        if (i > 0) doc.line(cx, tableY, cx, tableY + headerHeight);
        cx += colWidth[i];
      }
      tableY += headerHeight;

      // Data rows — dynamic height + page break support
      doc.setFont(PDF_FONT, 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(68, 68, 68);

      const addNewPage = () => {
        if (!pageCtx) return;
        doc.addPage();
        pageCtx.currentPage++;
        // Render header/footer on new page
        if (pageCtx.headerConfig) renderHF(doc, pageCtx.headerConfig, pageCtx.pageWidth, 0, 'header');
        if (pageCtx.footerConfig) renderHF(doc, pageCtx.footerConfig, pageCtx.pageWidth, pageCtx.pageHeight - (pageCtx.footerConfig.height ?? 15), 'footer');
        tableY = pageCtx.contentTop;
        // Re-draw table header on new page
        doc.setFillColor(240, 240, 240);
        doc.rect(tableX, tableY, tableWidth, headerHeight, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.rect(tableX, tableY, tableWidth, headerHeight);
        doc.setFont(PDF_FONT, 'bold');
        doc.setFontSize(headerFontSize);
        doc.setTextColor(51, 51, 51);
        let hx = tableX;
        for (let i = 0; i < columns.length; i++) {
          doc.text(doc.splitTextToSize(headerTexts[i], colWidth[i] - cellPad * 2), hx + cellPad, tableY + cellPad + headerFontSize * 0.35);
          if (i > 0) doc.line(hx, tableY, hx, tableY + headerHeight);
          hx += colWidth[i];
        }
        tableY += headerHeight;
        doc.setFont(PDF_FONT, 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(68, 68, 68);
      };

      for (const row of rows) {
        const cellTexts = columns.map(c => String(resolveFieldPath(row, c.field) ?? ''));
        const rh = calcRowHeight(cellTexts, fontSize);

        // Check if row exceeds page bottom — add new page
        if (pageCtx && tableY + rh > pageCtx.contentBottom) {
          addNewPage();
        }

        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.rect(tableX, tableY, tableWidth, rh);
        cx = tableX;
        for (let i = 0; i < columns.length; i++) {
          const wrapped = doc.splitTextToSize(cellTexts[i], colWidth[i] - cellPad * 2);
          doc.text(wrapped, cx + cellPad, tableY + cellPad + fontSize * 0.35);
          if (i > 0) doc.line(cx, tableY, cx, tableY + rh);
          cx += colWidth[i];
        }
        tableY += rh;
      }
      break;
    }
  }
}

function renderHF(doc: jsPDF, rawCfg: PdfHFConfig, pw: number, yStart: number, type: 'header' | 'footer'): void {
  // height eksik sablonlarda NaN koordinat jsPDF.text'i "Invalid arguments" ile patlatiyordu
  const cfg = { ...rawCfg, height: rawCfg.height ?? 15 };
  const margin = 20;
  const color = cfg.color ?? '#666666';
  const cr = parseInt(color.slice(1, 3), 16);
  const cg = parseInt(color.slice(3, 5), 16);
  const cb = parseInt(color.slice(5, 7), 16);
  if (cfg.logoUrl) {
    const lw = cfg.logoWidth ?? 20;
    const lh = cfg.logoHeight ?? 10;
    let lx = margin;
    if (cfg.logoAlign === 'center') lx = (pw - lw) / 2;
    else if (cfg.logoAlign === 'right') lx = pw - margin - lw;
    try { doc.addImage(cfg.logoUrl, 'AUTO', lx, yStart + (cfg.height - lh) / 2, lw, lh); } catch {}
  }
  if (cfg.text) {
    doc.setFont(PDF_FONT, 'normal');
    doc.setFontSize(cfg.fontSize ?? 10);
    doc.setTextColor(cr, cg, cb);
    let tx = margin;
    let align: 'left' | 'center' | 'right' = 'left';
    if (cfg.textAlign === 'center') { tx = pw / 2; align = 'center'; }
    else if (cfg.textAlign === 'right') { tx = pw - margin; align = 'right'; }
    doc.text(cfg.text, tx, yStart + cfg.height / 2 + (cfg.fontSize ?? 10) * 0.15, { align });
  }
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  if (type === 'header') doc.line(margin, yStart + cfg.height, pw - margin, yStart + cfg.height);
  else doc.line(margin, yStart, pw - margin, yStart);
}

function renderPageNum(doc: jsPDF, cfg: PdfPageNumConfig, pw: number, ph: number, page: number, total: number): void {
  const color = cfg.color ?? '#999999';
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(cfg.fontSize ?? 9);
  doc.setTextColor(parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16));
  const fmt = (cfg.format ?? '{{page}} / {{pages}}').replace(/\{\{page\}\}/g, String(page)).replace(/\{\{pages\}\}/g, String(total));
  const pos = cfg.position ?? 'bottom-center';
  const isTop = pos.startsWith('top');
  const y = isTop ? 12 : ph - 8;
  let x = 20;
  let align: 'left' | 'center' | 'right' = 'left';
  if (pos.endsWith('center')) { x = pw / 2; align = 'center'; }
  else if (pos.endsWith('right')) { x = pw - 20; align = 'right'; }
  doc.text(fmt, x, y, { align });
}

export function usePdfGenerate() {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async (
    template: PdfTemplate,
    urlParams?: Record<string, string>,
  ) => {
    setLoading(true);
    try {
      let data: unknown = undefined;

      // Fetch API data if binding configured
      if (template.apiBinding?.url) {
        let url = template.apiBinding.url;
        for (const p of template.apiBinding.params ?? []) {
          const val = urlParams?.[p.name] ?? p.defaultValue ?? '';
          url = url.replace(`{{${p.name}}}`, encodeURIComponent(val)).replace(`{${p.name}}`, encodeURIComponent(val));
        }
        if (!/^https?:\/\//.test(url)) {
          url = API_BASE.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
        }
        // Supabase dataProvider'inda getRequestHeaders yok
        const authHeaders = (dataProviderModule as unknown as { getRequestHeaders?: () => Record<string, string> }).getRequestHeaders?.() ?? {};
        const res = await fetch(url, {
          method: template.apiBinding.method,
          headers: { 'Content-Type': 'application/json', ...authHeaders, ...(template.apiBinding.headers ?? {}) },
          body: template.apiBinding.method === 'POST' && template.apiBinding.body ? template.apiBinding.body : undefined,
        });
        if (!res.ok) throw new Error(`PDF verisi alinamadi (HTTP ${res.status})`);
        data = await res.json();
      }

      const dims = PAGE_SIZES[template.pageSize] ?? PAGE_SIZES.a4;
      const w = template.orientation === 'portrait' ? dims.width : dims.height;
      const h = template.orientation === 'portrait' ? dims.height : dims.width;

      const doc = new jsPDF({
        orientation: template.orientation === 'portrait' ? 'p' : 'l',
        unit: 'mm',
        format: [w, h],
      });
      registerPdfFont(doc);

      const headerH = template.headerConfig?.enabled ? (template.headerConfig.height ?? 15) : 0;
      const footerH = template.footerConfig?.enabled ? (template.footerConfig.height ?? 15) : 0;
      const contentTop = (template.contentMarginTop ?? 20) + headerH;
      const contentBottom = h - (template.contentMarginBottom ?? 20) - footerH;
      const contentHeight = contentBottom - contentTop;

      const sorted = [...template.elements].sort((a, b) => a.y - b.y);
      let maxY = 0;
      // Exclude table elements from page calculation — they manage their own pages
      for (const el of sorted) { if (el.type !== 'table' && el.y + el.height > maxY) maxY = el.y + el.height; }
      const totalPages = Math.max(1, Math.ceil(maxY / contentHeight));
      const pageCtx: PageContext = {
        contentTop, contentBottom, pageWidth: w, pageHeight: h,
        headerConfig: template.headerConfig?.enabled ? template.headerConfig : undefined,
        footerConfig: template.footerConfig?.enabled ? template.footerConfig : undefined,
        pageNumConfig: template.pageNumberConfig?.enabled ? template.pageNumberConfig : undefined,
        currentPage: 1, totalPages,
      };

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) doc.addPage();
        pageCtx.currentPage = page + 1;
        // Header
        if (template.headerConfig?.enabled) {
          renderHF(doc, template.headerConfig, w, 0, 'header');
        }
        // Footer
        if (template.footerConfig?.enabled) {
          renderHF(doc, template.footerConfig, w, h - footerH, 'footer');
        }
        // Page numbers
        if (template.pageNumberConfig?.enabled) {
          renderPageNum(doc, template.pageNumberConfig, w, h, page + 1, totalPages);
        }
        // Elements
        const pageOffsetY = page * contentHeight;
        for (const el of sorted) {
          if (el.y + el.height <= pageOffsetY || el.y >= pageOffsetY + contentHeight) continue;
          // Table elements manage their own page breaks — only render on first occurrence
          if (el.type === 'table' && page > 0) continue;
          renderElement(doc, { ...el, y: el.y - pageOffsetY + contentTop }, data, pageCtx);
        }
      }

      // Re-render page numbers on all pages (table may have added extra pages)
      if (template.pageNumberConfig?.enabled) {
        const finalPages = doc.getNumberOfPages();
        for (let p = 1; p <= finalPages; p++) {
          doc.setPage(p);
          // Clear old page number area
          const pnPos = template.pageNumberConfig.position ?? 'bottom-center';
          const pnY = pnPos.startsWith('top') ? 5 : h - 15;
          doc.setFillColor(255, 255, 255);
          doc.rect(0, pnY, w, 12, 'F');
          renderPageNum(doc, template.pageNumberConfig, w, h, p, finalPages);
        }
      }

      const blob = doc.output('blob');
      setBlobUrl(URL.createObjectURL(blob));
    } finally {
      setLoading(false);
    }
  }, []);

  const download = useCallback((template: PdfTemplate, urlParams?: Record<string, string>) => {
    generate(template, urlParams);
  }, [generate]);

  return { blobUrl, setBlobUrl, loading, generate, download };
}
