import React from 'react';
import { Button, Field as SparField, Input, Checkbox, Select, Table } from '@takeoff-ui/react-spar';
import { permissionApi, type PermissionDto } from './rbacApi';

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

export const PermissionPicker: React.FC<Props> = ({ selected, onChange, disabled }) => {
  const [perms, setPerms] = React.useState<PermissionDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    permissionApi.getAll()
      .then(setPerms)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 12, color: '#888' }}>Loading permissions...</div>;
  if (error) return <div style={{ padding: 12, color: '#d32f2f' }}>Failed to load permissions: {error}</div>;

  const grouped = perms.reduce<Record<string, PermissionDto[]>>((acc, p) => {
    (acc[p.group] = acc[p.group] || []).push(p);
    return acc;
  }, {});
  const groupNames = Object.keys(grouped).sort((a, b) => {
    const aRbac = grouped[a][0]?.isRbac ?? false;
    const bRbac = grouped[b][0]?.isRbac ?? false;
    if (aRbac !== bRbac) return aRbac ? 1 : -1;
    return a.localeCompare(b);
  });

  const sel = new Set(selected);
  const toggle = (name: string) => {
    if (disabled) return;
    const next = new Set(sel);
    if (next.has(name)) next.delete(name); else next.add(name);
    onChange([...next]);
  };
  const toggleGroup = (groupName: string, all: boolean) => {
    if (disabled) return;
    const groupPerms = grouped[groupName].map(p => p.name);
    const next = new Set(sel);
    for (const p of groupPerms) { if (all) next.add(p); else next.delete(p); }
    onChange([...next]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {groupNames.map(g => {
        const groupPerms = grouped[g];
        const groupCount = groupPerms.length;
        const groupSelected = groupPerms.filter(p => sel.has(p.name)).length;
        const allOn = groupSelected === groupCount;

        return (
          <div key={g} style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: 12, background: '#fafafa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontWeight: 600 }}>
              <Checkbox checked={allOn} disabled={disabled} onChange={(c: boolean) => toggleGroup(g, !allOn)}><Checkbox.Indicator /></Checkbox>
              <span>{g}</span>
              <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>({groupSelected}/{groupCount})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, paddingLeft: 24 }}>
              {groupPerms.map(p => {
                const action = p.name.split('.').slice(1).join('.') || p.name;
                return (
                  <div key={p.name} title={p.description} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <Checkbox checked={sel.has(p.name)} disabled={disabled} onChange={(c: boolean) => toggle(p.name)}><Checkbox.Indicator /></Checkbox>
                    <span style={{ cursor: disabled ? 'default' : 'pointer' }} onClick={() => toggle(p.name)}>{action}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
