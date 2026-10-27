import React from 'react';
import { Button, Field as SparField, Input, Checkbox, Select, Table } from '@takeoff-ui/react-spar';
import { actionColumn, registerCrudHandler } from '../shared/ActionButtons';
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog';
import { userApi, roleApi, type AppUserDto, type AppRoleDto } from './rbacApi';

const BASE_COLUMNS = [
  { field: 'id', header: 'ID', sortable: true },
  { field: 'userName', header: 'Username', sortable: true, searchable: true },
  { field: 'fullName', header: 'Name', sortable: true, searchable: true },
  { field: 'emailAddress', header: 'Email', sortable: true, searchable: true },
  { field: 'roleNames', header: 'Role', sortable: true, searchable: true },
  { field: 'statusLabel', header: 'Status', sortable: true },
];

export default function UserListScreen() {
  const [users, setUsers] = React.useState<AppUserDto[]>([]);
  const [allRoles, setAllRoles] = React.useState<AppRoleDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [editUser, setEditUser] = React.useState<AppUserDto | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<AppUserDto | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([userApi.list(), roleApi.list()]);
      setUsers(u.items ?? []);
      setAllRoles(r.items ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Row-level edit/delete via global crud handler (html column buttons trigger window.__crud_action__)
  React.useEffect(() => {
    return registerCrudHandler((action, id) => {
      const u = users.find(x => String(x.id) === id);
      if (!u) return;
      if (action === 'edit') { setEditUser(u); return; }
      if (action === 'delete') {
        if (u.userName === 'admin') { alert('The default admin user cannot be deleted.'); return; }
        // Frontend safety: refuse if this is the last user with the Admin role
        const adminRoleCarriers = users.filter(x => x.roleNames.includes('Admin'));
        if (u.roleNames.includes('Admin') && adminRoleCarriers.length <= 1) {
          alert('Cannot delete the last user with the Admin role. Assign Admin to another user first.');
          return;
        }
        setConfirmDelete(u);
      }
    });
  }, [users, load]);

  const rows = users.map(u => ({
    ...u,
    fullName: `${u.name} ${u.surname}`.trim(),
    roleNames: u.roleNames.join(', '),
    statusLabel: u.isActive ? 'Active' : 'Inactive',
  }));

  const columns = [...BASE_COLUMNS, ...actionColumn('id', { hasEdit: true, hasDelete: true })];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Users</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)}>+ New User</Button>
      </div>
      {error && <div style={{ padding: 12, background: '#fdecea', color: '#d32f2f', borderRadius: 4, marginBottom: 12 }}>{error}</div>}

      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 6, overflow: 'hidden' }}>
        <Table<any>
          data={rows as any[]}
          columns={(columns as any[]).map((c) => ({ id: c.field, header: c.header, cell: ({ row }: any) => c.html ? <span dangerouslySetInnerHTML={{ __html: c.html(row.original) }} /> : String(row.original[c.field] ?? '') }))}
          getRowId={(row: any, i: number) => String(row["id"] ?? i)}
          loading={loading}
          size="small"
        />
        {users.length === 0 && !loading && (
          <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>No users yet.</div>
        )}
      </div>

      <UserCreateModal open={showCreate} onClose={() => setShowCreate(false)} onSuccess={load} allRoles={allRoles} />
      <UserEditModal user={editUser} onClose={() => setEditUser(null)} onSuccess={load} allRoles={allRoles} />

      <DeleteConfirmDialog
        visible={!!confirmDelete}
        label={confirmDelete?.userName ?? ''}
        isPending={false}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          const u = confirmDelete;
          userApi.delete(u.id).then(load).catch(e => alert(e.message));
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}


const ModalShell: React.FC<{ open: boolean; title: string; onClose: () => void; children: React.ReactNode }> = ({ open, title, onClose, children }) => {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 8, width: '90%', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #e0e0e0' }}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>{children}</div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={{ fontSize: 12, color: '#666' }}>{label}{required && <span style={{ color: '#d32f2f' }}> *</span>}</label>
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// User Create Modal
// ---------------------------------------------------------------------------

const UserCreateModal: React.FC<{ open: boolean; onClose: () => void; onSuccess: () => void; allRoles: AppRoleDto[] }> = ({ open, onClose, onSuccess, allRoles }) => {
  const [userName, setUserName] = React.useState('');
  const [emailAddress, setEmailAddress] = React.useState('');
  const [name, setName] = React.useState('');
  const [surname, setSurname] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);
  const [roleId, setRoleId] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setUserName(''); setEmailAddress(''); setName(''); setSurname('');
      setPassword(''); setIsActive(true); setRoleId(''); setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    setError(null); setSaving(true);
    try {
      await userApi.create({
        userName, emailAddress, name, surname, password, isActive,
        roleIds: roleId ? [Number(roleId)] : [],
      });
      onSuccess(); onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const roleOptions = allRoles.map(r => ({ label: r.displayName || r.name, value: String(r.id) }));

  return (
    <ModalShell open={open} title="New User" onClose={onClose}>
      {error && <div style={{ padding: 12, background: '#fdecea', color: '#d32f2f', borderRadius: 4, marginBottom: 16 }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Field label="Username" required>
          <Input><Input.Field type="text" value={userName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserName(e.target.value)} /></Input>
        </Field>
        <Field label="Email" required>
          <Input><Input.Field type="text" value={emailAddress} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmailAddress(e.target.value)} /></Input>
        </Field>
        <Field label="First Name" required>
          <Input><Input.Field type="text" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} /></Input>
        </Field>
        <Field label="Last Name">
          <Input><Input.Field type="text" value={surname} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSurname(e.target.value)} /></Input>
        </Field>
        <Field label="Password" required>
          <Input><Input.Field type="password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} /></Input>
        </Field>
        <Field label="Status">
          <SparField><SparField.Label>Active</SparField.Label><Checkbox checked={isActive} onChange={(c: boolean) => setIsActive(c)}><Checkbox.Indicator /></Checkbox></SparField>
        </Field>
        <Field label="Role">
          <Select value={roleId || undefined} onChange={(v) => setRoleId(String(v ?? ''))}><Select.Trigger placeholder="Select a role" /><Select.Content>{(roleOptions as any[]).map((o) => <Select.Item key={String(o.value)} value={String(o.value)}>{o.label}</Select.Item>)}</Select.Content></Select>
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'flex-end' }}>
        <Button variant="neutral" appearance="outlined" onClick={() => onClose()}>Cancel</Button>
        <Button variant="primary" onClick={() => handleSave()} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </ModalShell>
  );
};

// ---------------------------------------------------------------------------
// User Edit Modal
// ---------------------------------------------------------------------------

const UserEditModal: React.FC<{ user: AppUserDto | null; onClose: () => void; onSuccess: () => void; allRoles: AppRoleDto[] }> = ({ user, onClose, onSuccess, allRoles }) => {
  const [userName, setUserName] = React.useState('');
  const [emailAddress, setEmailAddress] = React.useState('');
  const [name, setName] = React.useState('');
  const [surname, setSurname] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);
  const [roleId, setRoleId] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      setUserName(user.userName); setEmailAddress(user.emailAddress);
      setName(user.name); setSurname(user.surname);
      setPassword(''); setIsActive(user.isActive);
      setRoleId(user.roleIds[0] ? String(user.roleIds[0]) : '');
      setError(null);
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setError(null); setSaving(true);
    try {
      await userApi.update({
        id: user.id, userName, emailAddress, name, surname, password, isActive,
        roleIds: roleId ? [Number(roleId)] : [],
      });
      onSuccess(); onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const roleOptions = allRoles.map(r => ({ label: r.displayName || r.name, value: String(r.id) }));

  return (
    <ModalShell open={!!user} title={`Edit User: ${user?.userName ?? ''}`} onClose={onClose}>
      {error && <div style={{ padding: 12, background: '#fdecea', color: '#d32f2f', borderRadius: 4, marginBottom: 16 }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Field label="Username" required>
          <Input><Input.Field type="text" value={userName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserName(e.target.value)} /></Input>
        </Field>
        <Field label="Email" required>
          <Input><Input.Field type="text" value={emailAddress} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmailAddress(e.target.value)} /></Input>
        </Field>
        <Field label="First Name" required>
          <Input><Input.Field type="text" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} /></Input>
        </Field>
        <Field label="Last Name">
          <Input><Input.Field type="text" value={surname} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSurname(e.target.value)} /></Input>
        </Field>
        <Field label="New Password (leave blank to keep)">
          <Input><Input.Field type="password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} /></Input>
        </Field>
        <Field label="Status">
          <SparField><SparField.Label>Active</SparField.Label><Checkbox checked={isActive} onChange={(c: boolean) => setIsActive(c)}><Checkbox.Indicator /></Checkbox></SparField>
        </Field>
        <Field label="Role">
          <Select value={roleId || undefined} onChange={(v) => setRoleId(String(v ?? ''))}><Select.Trigger placeholder="Select a role" /><Select.Content>{(roleOptions as any[]).map((o) => <Select.Item key={String(o.value)} value={String(o.value)}>{o.label}</Select.Item>)}</Select.Content></Select>
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'flex-end' }}>
        <Button variant="neutral" appearance="outlined" onClick={() => onClose()}>Cancel</Button>
        <Button variant="primary" onClick={() => handleSave()} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </ModalShell>
  );
};
