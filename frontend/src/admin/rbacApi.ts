import { API_BASE } from '../config';
import { authFetch } from '../dataProvider';

// ABP yaniti { result, success, __abp } ile sarar. result null olabilir (ör. hic senkron yok) —
// `json?.result ?? json` o durumda sarmalayiciyi dondurup ekranda "Invalid Date" gosteriyordu.
const unwrap = <T,>(json: any): T => (json && typeof json === 'object' && '__abp' in json ? json.result : json) as T;

const handle401 = (status: number): boolean => {
  if (status !== 401) return false;
  ['_auth_token', '_bearer_token', '_refresh_token'].forEach(k => localStorage.removeItem(k));
  if (window.location.pathname !== '/login') window.location.href = '/login';
  return true;
};

async function abpGet<T>(path: string): Promise<T> {
  const res = await authFetch(`${API_BASE}${path}`);
  if (handle401(res.status)) throw new Error('Unauthorized');
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return unwrap<T>(json);
}

async function abpPost<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (handle401(res.status)) throw new Error('Unauthorized');
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { const j = JSON.parse(text); msg = j?.error?.message ?? j?.error ?? text; } catch {}
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  const json = await res.json();
  return unwrap<T>(json);
}

// ABP exposes UpdateAsync as HTTP PUT — POSTing to it returns 405.
async function abpPut<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (handle401(res.status)) throw new Error('Unauthorized');
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { const j = JSON.parse(text); msg = j?.error?.message ?? j?.error ?? text; } catch {}
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  const json = await res.json();
  return unwrap<T>(json);
}

// ABP exposes DeleteAsync as HTTP DELETE — POSTing to it returns 405.
async function abpDelete<T>(path: string): Promise<T> {
  const res = await authFetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (handle401(res.status)) throw new Error('Unauthorized');
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { const j = JSON.parse(text); msg = j?.error?.message ?? j?.error ?? text; } catch {}
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  return unwrap<T>(json);
}

export interface AppUserDto {
  id: number;
  userName: string;
  emailAddress: string;
  name: string;
  surname: string;
  isActive: boolean;
  roleIds: number[];
  roleNames: string[];
}

export interface CreateAppUserDto {
  userName: string;
  emailAddress: string;
  name: string;
  surname: string;
  password: string;
  isActive: boolean;
  roleIds: number[];
}

export type UpdateAppUserDto = CreateAppUserDto & { id: number };

export const userApi = {
  list: (skip = 0, max = 50) =>
    abpGet<{ totalCount: number; items: AppUserDto[] }>(`/api/services/app/AppUser/GetAll?SkipCount=${skip}&MaxResultCount=${max}`),
  get: (id: number) =>
    abpGet<AppUserDto>(`/api/services/app/AppUser/Get?id=${id}`),
  create: (input: CreateAppUserDto) =>
    abpPost<AppUserDto>('/api/services/app/AppUser/Create', input),
  update: (input: UpdateAppUserDto) =>
    abpPut<AppUserDto>('/api/services/app/AppUser/Update', input),
  delete: (id: number) =>
    abpDelete<void>(`/api/services/app/AppUser/Delete?id=${id}`),
};

export interface AppRoleDto {
  id: number;
  name: string;
  displayName: string;
  description: string;
  isSystem: boolean;
  isActive: boolean;
  permissions: string[];
}

export interface CreateAppRoleDto {
  name: string;
  displayName: string;
  description: string;
  isActive: boolean;
  permissions: string[];
}

export type UpdateAppRoleDto = CreateAppRoleDto & { id: number };

export const roleApi = {
  list: (skip = 0, max = 100) =>
    abpGet<{ totalCount: number; items: AppRoleDto[] }>(`/api/services/app/AppRole/GetAll?SkipCount=${skip}&MaxResultCount=${max}`),
  get: (id: number) =>
    abpGet<AppRoleDto>(`/api/services/app/AppRole/Get?id=${id}`),
  create: (input: CreateAppRoleDto) =>
    abpPost<AppRoleDto>('/api/services/app/AppRole/Create', input),
  update: (input: UpdateAppRoleDto) =>
    abpPut<AppRoleDto>('/api/services/app/AppRole/Update', input),
  delete: (id: number) =>
    abpDelete<void>(`/api/services/app/AppRole/Delete?id=${id}`),
};

export interface PermissionDto {
  name: string;
  group: string;
  description: string;
  isRbac: boolean;
}

export const permissionApi = {
  getAll: () => abpGet<PermissionDto[]>('/api/services/app/Permission/GetAll'),
};
