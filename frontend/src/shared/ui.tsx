import React from 'react';
import {
  Alert, Button, Card, Checkbox, Dialog, Field, Input, Popover, Calendar, Select, Stepper, Tabs, useDatePicker,
} from '@takeoff-ui/react-spar';

// Neutral UI wrappers — dashboards/shared components import these so the same
// generated JSX renders on any UI framework. This file is the Takeoff v2 (Spar) impl.

export const UiCard: React.FC<{ header?: string; bodyStyle?: React.CSSProperties; children?: React.ReactNode }> = ({ header, bodyStyle, children }) => (
  <Card style={{ height: '100%' }}>
    {header ? <Card.Header><Card.Title>{header}</Card.Title></Card.Header> : null}
    <Card.Body style={bodyStyle}>{children}</Card.Body>
  </Card>
);

const ALERT_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'neutral'> = {
  info: 'info', success: 'success', warning: 'warning', danger: 'danger', error: 'danger', neutral: 'neutral',
};
export const UiAlert: React.FC<{ variant?: string; message?: string; header?: string }> = ({ variant = 'info', message, header }) => (
  <Alert variant={ALERT_VARIANT[variant] ?? 'info'}>
    <Alert.Content>
      {header ? <Alert.Title>{header}</Alert.Title> : null}
      {message ? <Alert.Description>{message}</Alert.Description> : null}
    </Alert.Content>
  </Alert>
);

export const UiButton: React.FC<{ label?: string; variant?: string; onClick?: () => void; disabled?: boolean }> = ({ label, variant = 'primary', onClick, disabled }) => (
  <Button
    variant={variant === 'danger' ? 'danger' : variant === 'neutral' ? 'neutral' : 'primary'}
    appearance={variant === 'secondary' || variant === 'neutral' ? 'outlined' : 'filled'}
    onClick={onClick}
    disabled={disabled}
  >{label}</Button>
);

export const UiTabsItem: React.FC<{ label: string; children?: React.ReactNode }> = ({ children }) => <>{children}</>;

export const UiTabs: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const items = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<{ label: string; children?: React.ReactNode }>[];
  return (
    <Tabs defaultValue="0">
      <Tabs.List>
        {items.map((it, i) => <Tabs.Trigger key={i} value={String(i)}>{it.props.label}</Tabs.Trigger>)}
      </Tabs.List>
      {items.map((it, i) => <Tabs.Content key={i} value={String(i)}>{it.props.children}</Tabs.Content>)}
    </Tabs>
  );
};

export const UiDialog: React.FC<{ visible: boolean; header?: string; onClose: () => void; footer?: React.ReactNode; children?: React.ReactNode }> = ({ visible, header, onClose, footer, children }) => (
  <Dialog open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
    <Dialog.Overlay />
    <Dialog.Panel>
      <Dialog.Header>
        {header ? <Dialog.Title>{header}</Dialog.Title> : null}
        <Dialog.Close />
      </Dialog.Header>
      <Dialog.Body>{children}</Dialog.Body>
      {footer ? <Dialog.Footer>{footer}</Dialog.Footer> : null}
    </Dialog.Panel>
  </Dialog>
);

// ---- Form alanlari (create/edit ekranlari bunlari kullanir) ----

export const SparTextField: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string; rows?: number }> = ({ label, value, onChange, type, rows }) => (
  <Field>
    <Field.Label>{label}</Field.Label>
    <Input>
      {rows
        ? <Input.Field as="textarea" rows={rows} value={value} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)} />
        : <Input.Field type={type ?? 'text'} value={value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} />}
    </Input>
  </Field>
);

export const SparSelectField: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: Array<{ label: string; value: string }> }> = ({ label, value, onChange, options }) => (
  <Field>
    <Field.Label>{label}</Field.Label>
    <Select value={value || undefined} onChange={(v) => onChange(v == null ? '' : String(v))}>
      <Select.Trigger placeholder="Seçiniz" />
      <Select.Content>
        {options.map((o) => <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>)}
      </Select.Content>
    </Select>
  </Field>
);

export const SparCheckbox: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <Field>
    <Field.Label>{label}</Field.Label>
    <Checkbox checked={checked} onChange={onChange}><Checkbox.Indicator /></Checkbox>
  </Field>
);

const pad2 = (n: number) => String(n).padStart(2, '0');
export const toIsoDate = (d: Date | undefined) => d ? d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) : '';
// new Date('YYYY-MM-DD') UTC kabul eder, yerel saatte bir gun kayabilir — parcalardan kurulur
export const parseIsoDate = (v: string | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : undefined;
};

// Tarih: Popover + Calendar + useDatePicker. Saat: v2'de saat secici yok — yanina native time input.
// Deger bicimi: 'YYYY-MM-DD' ya da withTime ile 'YYYY-MM-DDTHH:mm:00'.
export const SparDateField: React.FC<{ label: string; value: string; onChange: (v: string) => void; withTime?: boolean; disabled?: boolean }> = ({ label, value, onChange, withTime, disabled }) => {
  const date = (value ?? '').slice(0, 10);
  const time = withTime && (value ?? '').length >= 16 ? value.slice(11, 16) : '';
  const emit = (d: string, t: string) => onChange(d ? (withTime ? d + 'T' + (t || '00:00') + ':00' : d) : '');
  const latest = React.useRef({ date, time });
  latest.current = { date, time };
  const picker = useDatePicker({
    defaultValue: parseIsoDate(date),
    onValueChange: (d) => { const iso = toIsoDate(d); if (iso !== latest.current.date) emit(iso, latest.current.time); },
  });
  // useDatePicker kontrollu deger almaz — disaridan gelen deger (duzenleme formu yuklenince) senkronlanir
  const { value: pickedValue, setValue } = picker;
  React.useEffect(() => {
    if (toIsoDate(pickedValue) !== date) setValue(parseIsoDate(date));
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Field disabled={disabled}>
      <Field.Label>{label}</Field.Label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: '100%' }}>
        <div style={{ flex: '1 1 150px', minWidth: 0 }}>
          <Popover {...picker.popoverProps}>
            <Input>
              <Input.Field placeholder="gg/aa/yyyy" {...picker.inputProps} style={{ minWidth: 0 }} />
              <Popover.Trigger aria-label="Tarih seç">📅</Popover.Trigger>
            </Input>
            <Popover.Content align="end"><Calendar {...picker.calendarProps} /></Popover.Content>
          </Popover>
        </div>
        {withTime ? (
          <Input style={{ width: 110, flexShrink: 0 }}>
            <Input.Field type="time" aria-label={label + ' saat'} value={time} disabled={!date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => emit(date, e.target.value)} />
          </Input>
        ) : null}
      </div>
    </Field>
  );
};

export type UiTreeItem = { key: string; label: string; children?: UiTreeItem[] };
export type UiOrgNode = { id: string; parentId: string | null; name: string; title: string };

const toggleStyle: React.CSSProperties = { border: 0, background: 'none', cursor: 'pointer', width: 20, padding: 0, color: 'inherit', fontSize: 12 };

const UiTreeNode: React.FC<{ item: UiTreeItem; depth: number }> = ({ item, depth }) => {
  const [open, setOpen] = React.useState(true);
  const hasChildren = !!item.children?.length;
  return (
    <li>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: depth * 20, minHeight: 28, fontSize: 14 }}>
        {hasChildren
          ? <button type="button" style={toggleStyle} aria-expanded={open} aria-label={(open ? 'Daralt: ' : 'Genişlet: ') + item.label} onClick={() => setOpen(!open)}>{open ? '▾' : '▸'}</button>
          : <span style={{ width: 20 }} />}
        <span>{item.label}</span>
      </div>
      {hasChildren && open ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {item.children!.map((c) => <UiTreeNode key={c.key} item={c} depth={depth + 1} />)}
        </ul>
      ) : null}
    </li>
  );
};

export const UiTreeView: React.FC<{ items: UiTreeItem[] }> = ({ items }) => (
  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
    {items.map((it) => <UiTreeNode key={it.key} item={it} depth={0} />)}
  </ul>
);

// Klasik CSS org semasi: dugum altindaki ul cocuklari yan yana dizer, ::before/::after baglanti cizgileri
const ORG_CSS = [
  '.ui-org ul{display:flex;justify-content:center;position:relative;margin:0;padding:20px 0 0}',
  '.ui-org>ul{padding-top:0}',
  '.ui-org li{list-style:none;text-align:center;position:relative;padding:20px 6px 0}',
  '.ui-org li::before,.ui-org li::after{content:"";position:absolute;top:0;right:50%;width:50%;height:20px;border-top:1px solid #C9CED8}',
  '.ui-org li::after{right:auto;left:50%;border-left:1px solid #C9CED8}',
  '.ui-org li:only-child::before,.ui-org li:only-child::after{display:none}',
  '.ui-org li:only-child{padding-top:0}',
  '.ui-org li:first-child::before,.ui-org li:last-child::after{border:0 none}',
  '.ui-org li:last-child::before{border-right:1px solid #C9CED8;border-radius:0 6px 0 0}',
  '.ui-org li:first-child::after{border-radius:6px 0 0 0}',
  '.ui-org ul ul::before{content:"";position:absolute;top:0;left:50%;height:20px;border-left:1px solid #C9CED8}',
].join('\n');

const UiOrgBranch: React.FC<{ node: UiOrgNode; byParent: Map<string, UiOrgNode[]>; nodeWidth: number }> = ({ node, byParent, nodeWidth }) => {
  const [open, setOpen] = React.useState(true);
  const children = byParent.get(node.id) ?? [];
  const box: React.CSSProperties = {
    boxSizing: 'border-box', width: nodeWidth, minHeight: 64, border: '1px solid #E1E4EA', borderRadius: 8, background: '#fff',
    padding: '8px 12px', display: 'inline-flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    textAlign: 'center', font: 'inherit', color: '#222530', cursor: children.length ? 'pointer' : 'default',
  };
  const content = (
    <>
      <span style={{ fontSize: 14, fontWeight: 600, lineHeight: '18px', overflowWrap: 'anywhere' }}>{node.name}</span>
      {node.title ? <span style={{ fontSize: 12, color: '#6B7280', lineHeight: '16px', marginTop: 4, overflowWrap: 'anywhere' }}>{node.title}</span> : null}
      {children.length && !open ? <span style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>+{children.length}</span> : null}
    </>
  );
  return (
    <li>
      {children.length
        ? <button type="button" style={box} aria-expanded={open} onClick={() => setOpen(!open)}>{content}</button>
        : <div style={box}>{content}</div>}
      {children.length && open ? (
        <ul>{children.map((c) => <UiOrgBranch key={c.id} node={c} byParent={byParent} nodeWidth={nodeWidth} />)}</ul>
      ) : null}
    </li>
  );
};

export const UiOrgChart: React.FC<{ nodes: UiOrgNode[]; nodeWidth?: number }> = ({ nodes, nodeWidth = 220 }) => {
  const { roots, byParent } = React.useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id));
    const map = new Map<string, UiOrgNode[]>();
    const rootList: UiOrgNode[] = [];
    for (const n of nodes) {
      if (n.parentId && ids.has(n.parentId) && n.parentId !== n.id) {
        const list = map.get(n.parentId) ?? [];
        list.push(n);
        map.set(n.parentId, list);
      } else rootList.push(n);
    }
    return { roots: rootList, byParent: map };
  }, [nodes]);
  if (nodes.length === 0) return <div style={{ color: '#999', fontSize: 13 }}>Kayıt yok</div>;
  return (
    <div className="ui-org" style={{ overflow: 'auto', padding: 8 }}>
      <style>{ORG_CSS}</style>
      <ul>{roots.map((r) => <UiOrgBranch key={r.id} node={r} byParent={byParent} nodeWidth={nodeWidth} />)}</ul>
    </div>
  );
};

export const UiTimeline: React.FC<{ items: Array<{ title: string; date?: string; description?: string }>; orientation?: 'vertical' | 'horizontal' }> = ({ items, orientation = 'vertical' }) => {
  const vertical = orientation === 'vertical';
  if (items.length === 0) return <div style={{ color: '#999', fontSize: 13 }}>Kayıt yok</div>;
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: vertical ? '0 0 0 8px' : '8px 0 0', display: 'flex', flexDirection: vertical ? 'column' : 'row', overflowX: vertical ? undefined : 'auto' }}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <li key={i} style={{
            position: 'relative', minWidth: vertical ? undefined : 180,
            padding: vertical ? '0 0 16px 20px' : '16px 16px 0 0',
            borderLeft: vertical ? '2px solid ' + (last ? 'transparent' : '#E1E4EA') : undefined,
            borderTop: vertical ? undefined : '2px solid ' + (last ? 'transparent' : '#E1E4EA'),
          }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: vertical ? -7 : 0, top: vertical ? 0 : -7, width: 12, height: 12, borderRadius: '50%', background: 'var(--primary-500, #1976d2)' }} />
            <div style={{ fontWeight: 600, fontSize: 14 }}>{it.title}</div>
            {it.date ? <div style={{ fontSize: 12, color: '#6B7280' }}>{it.date}</div> : null}
            {it.description ? <div style={{ fontSize: 13, marginTop: 4 }}>{it.description}</div> : null}
          </li>
        );
      })}
    </ol>
  );
};

export const UiStepper: React.FC<{ steps: string[]; active?: number }> = ({ steps, active = 0 }) => (
  <Stepper active={active}>
    {steps.map((s, i) => <Stepper.Item key={i}><Stepper.Title>{s}</Stepper.Title></Stepper.Item>)}
  </Stepper>
);
