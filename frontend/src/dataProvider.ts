import { API_BASE, CUSTOM_HEADERS, TOKEN_ENDPOINT, LOGIN_FIELD, TOKEN_RESPONSE_PATH } from './config';

// Auth: Token-based login — config values from .env via config.ts
const TOKEN_PATH = TOKEN_RESPONSE_PATH;

const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object') ? (o as Record<string, unknown>)[k] : undefined, obj);

// Try configured path first, then common fallback paths
const extractToken = (data: Record<string, unknown>, path: string): string | undefined => {
  const val = getNestedValue(data, path) as string | undefined;
  if (val) return val;
  // Fallback: try common token locations
  const fallbacks = ['data.token', 'data.accessToken', 'data.access_token', 'token', 'accessToken', 'access_token', 'result.token', 'result.accessToken', 'result.result.accessToken'];
  for (const fb of fallbacks) {
    if (fb === path) continue;
    const v = getNestedValue(data, fb) as string | undefined;
    if (v && typeof v === 'string' && v.length > 10) return v;
  }
  return undefined;
};

let _authToken = localStorage.getItem('_auth_token') || '';
let _refreshToken = localStorage.getItem('_refresh_token') || '';

// Decodes JWT and persists permission + role claims (set by TokenAuthController on login)
// so PermissionGuard / hasPermission can answer without an extra fetch.
const decodeAndStoreClaims = (token: string) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const collect = (v: unknown): string[] => v == null ? [] : Array.isArray(v) ? v.map(String) : [String(v)];
    const ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
    const perms = collect(payload.permission);
    const roles = collect(payload.role).concat(collect(payload[ROLE_CLAIM]));
    localStorage.setItem('_permissions', JSON.stringify(perms));
    localStorage.setItem('_roles', JSON.stringify(roles));
  } catch { /* not a JWT — leave claims unset */ }
};
export const setAuthToken = (token: string) => { _authToken = token; localStorage.setItem('_auth_token', token); decodeAndStoreClaims(token); };
export const getAuthToken = () => _authToken;
export const setRefreshToken = (token: string) => { _refreshToken = token; localStorage.setItem('_refresh_token', token); };
export const getRefreshToken = () => _refreshToken;
export const clearAuth = () => { _authToken = ''; _refreshToken = ''; localStorage.removeItem('_auth_token'); localStorage.removeItem('_refresh_token'); localStorage.removeItem('_permissions'); localStorage.removeItem('_roles'); };
export const isAuthenticated = () => !!_authToken;

export const loginWithCredentials = async (credential: string, password: string): Promise<boolean> => {
  const url = TOKEN_ENDPOINT.startsWith("http") ? TOKEN_ENDPOINT : `${API_BASE}${TOKEN_ENDPOINT.startsWith("/") ? "" : "/"}${TOKEN_ENDPOINT}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [LOGIN_FIELD]: credential, password }) });
  if (!res.ok) return false;
  const data = await res.json() as Record<string, unknown>;
  const token = extractToken(data, TOKEN_PATH);
  if (!token) return false;
  setAuthToken(token);
  // Save user info for header display
  localStorage.setItem('_user_name', credential.split('@')[0] || credential);
  localStorage.setItem('_user_email', credential);
  // Also check for refresh token in response
  const rt = (getNestedValue(data, 'data.refreshToken') ?? getNestedValue(data, 'refreshToken') ?? getNestedValue(data, 'data.refresh_token')) as string | undefined;
  if (rt) setRefreshToken(rt);
  return true;
};

const authHeaders: Record<string, string> = {};

interface ResourceConfig {
  path: string;
  listMethod?: 'POST';
  paginationStyle?: 'page-size' | 'offset-limit';
  pageParam?: string;
  sizeParam?: string;
  sortStyle?: 'combined' | 'split';
  sortParam?: string;
  orderParam?: string;
  filterStyle?: 'search' | 'bracket' | 'raw';
  searchParam?: string;
  abpStyle?: true;
}

const RESOURCE_CONFIG: Record<string, ResourceConfig> = {
  'LeaveRequest': { path: 'api/services/app/LeaveRequest', paginationStyle: 'offset-limit', pageParam: 'SkipCount', sizeParam: 'MaxResultCount', sortStyle: 'combined', sortParam: 'Sorting', filterStyle: 'search', searchParam: 'Keyword', abpStyle: true },
  'LeaveBalance': { path: 'api/services/app/LeaveBalance', paginationStyle: 'offset-limit', pageParam: 'SkipCount', sizeParam: 'MaxResultCount', sortStyle: 'combined', sortParam: 'Sorting', filterStyle: 'search', searchParam: 'Keyword', abpStyle: true },
  'User': { path: 'api/services/app/AppUser', paginationStyle: 'offset-limit', pageParam: 'SkipCount', sizeParam: 'MaxResultCount', sortStyle: 'combined', sortParam: 'Sorting', filterStyle: 'search', searchParam: 'Keyword', abpStyle: true },
  'Role': { path: 'api/services/app/AppRole', paginationStyle: 'offset-limit', pageParam: 'SkipCount', sizeParam: 'MaxResultCount', sortStyle: 'combined', sortParam: 'Sorting', filterStyle: 'search', searchParam: 'Keyword', abpStyle: true },
};

const cfg = (resource: string): ResourceConfig => RESOURCE_CONFIG[resource] ?? { path: resource };
const isAbp = (resource: string) => !!(cfg(resource) as any).abpStyle;

interface ListParams {
  pagination?: { page: number; perPage: number };
  sort?: { field: string; order: 'ASC' | 'DESC' };
  filter?: Record<string, unknown>;
}

interface ListResult<T = unknown> {
  data: T[];
  total: number;
}

// Smart response unwrapping — handles { data, items, results, records, rows, content, list }
const ARRAY_KEYS = ["data", "items", "results", "records", "rows", "content", "list"];
const TOTAL_KEYS = ["total", "totalCount", "total_count", "count", "totalElements", "totalItems", "totalRecords"];

const unwrapList = <T>(raw: unknown): ListResult<T> => {
  if (Array.isArray(raw)) return { data: raw, total: raw.length };
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    let arr: T[] | undefined;
    for (const key of ARRAY_KEYS) {
      if (Array.isArray(obj[key])) { arr = obj[key] as T[]; break; }
    }
    if (!arr) {
      for (const val of Object.values(obj)) {
        if (Array.isArray(val)) { arr = val as T[]; break; }
      }
    }
    if (arr) {
      let total = arr.length;
      for (const key of TOTAL_KEYS) {
        if (typeof obj[key] === "number") { total = obj[key] as number; break; }
      }
      return { data: arr, total };
    }
  }
  return { data: [], total: 0 };
};

// ETag cache for optimistic concurrency (prevents 412 Precondition Failed)
const _etagCache = new Map<string, string>();

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...authHeaders,
    ...CUSTOM_HEADERS,
  };
  // Only set Content-Type when there is a body (POST/PUT/PATCH)
  if (init?.body) headers['Content-Type'] = 'application/json';
  if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;

  // Attach If-Match header for PUT/PATCH/DELETE if we have a cached ETag
  const method = (init?.method ?? 'GET').toUpperCase();
  if (['PUT', 'PATCH', 'DELETE'].includes(method) && _etagCache.has(url)) {
    headers['If-Match'] = _etagCache.get(url)!;
  }
  let res = await fetch(url, { ...init, headers });
  // If 412 Precondition Failed, retry without If-Match (server may have stale ETag)
  if (res.status === 412) {
    delete headers['If-Match'];
    _etagCache.delete(url);
    res = await fetch(url, { ...init, headers });
  }
  // 401 Unauthorized → clear auth and redirect to login
  if (res.status === 401) {
    localStorage.removeItem('_auth_token');
    localStorage.removeItem('_bearer_token');
    localStorage.removeItem('_refresh_token');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized — redirecting to login');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    // Parse ABP error response for user-friendly message
    let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errorJson = JSON.parse(text);
      const abpError = errorJson?.error ?? errorJson?.result?.error;
      if (abpError) {
        errorMsg = abpError.details || abpError.message || errorMsg;
        if (abpError.validationErrors?.length) {
          errorMsg = abpError.validationErrors.map((e: { message: string }) => e.message).join("\n");
        }
      }
    } catch { /* not JSON, use raw text */ errorMsg = text || errorMsg; }
    throw new Error(errorMsg);
  }
  // Cache ETag from response for future updates
  const etag = res.headers.get('etag');
  if (etag) _etagCache.set(url, etag);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
};

/** Build auth+custom headers for external fetch calls (e.g. dashboard blocks) */
export const getRequestHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { Accept: 'application/json', ...CUSTOM_HEADERS };
  if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;

  return headers;
};

/** request() disindaki cagrilar (dashboard, yonetim ekranlari) icin: auth basliklari + 401'de bir kez yenile */
export const authFetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const go = () => fetch(url, { ...init, headers: { ...getRequestHeaders(), ...(init.headers as Record<string, string> | undefined) } });
  let res = await go();
  return res;
};

export const dataProvider = {
  list: async <T>(resource: string, params: ListParams = {}): Promise<ListResult<T>> => {
    const c = cfg(resource);

    if (c.listMethod === 'POST') {
      const body: Record<string, unknown> = {};
      if (params.pagination && c.pageParam) {
        body[c.pageParam] = params.pagination.page;
        body[c.sizeParam ?? 'limit'] = params.pagination.perPage;
      }
      if (params.sort && c.sortParam) {
        body[c.sortParam] = params.sort.field;
        if (c.orderParam) body[c.orderParam] = params.sort.order.toLowerCase();
      }
      if (params.filter) {
        Object.entries(params.filter).forEach(([k, v]) => {
          if (v !== '' && v !== undefined && v !== null) body[k] = v;
        });
      }
      const raw = await request<T[] | ListResult<T>>(`${API_BASE}/${c.path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return unwrapList<T>(raw);
    }

    // GET-based list
    const qs = new URLSearchParams();
    const { pagination, sort, filter } = params;

    if (pagination && c.pageParam) {
      if (c.paginationStyle === 'offset-limit') {
        qs.set(c.pageParam, String((pagination.page - 1) * pagination.perPage));
      } else {
        qs.set(c.pageParam, String(pagination.page));
      }
      if (c.sizeParam) qs.set(c.sizeParam, String(pagination.perPage));
    }

    if (sort && c.sortParam) {
      if (c.sortStyle === 'combined') {
        const sep = (c as any).abpStyle ? " " : ",";
        qs.set(c.sortParam, `${sort.field}${sep}${sort.order.toLowerCase()}`);
      } else {
        qs.set(c.sortParam, sort.field);
        if (c.orderParam) qs.set(c.orderParam, sort.order.toLowerCase());
      }
    }

    if (filter) {
      if (c.filterStyle === 'search' && c.searchParam) {
        // Search style: Keyword → searchParam, other keys → direct query params
        const searchParam = c.searchParam;
        Object.entries(filter).forEach(([k, v]) => {
          if (v === '' || v === undefined || v === null) return;
          if (k === searchParam || k === "Keyword") { qs.set(searchParam, String(v)); }
          else { qs.set(k, String(v)); }
        });
      } else {
        Object.entries(filter).forEach(([k, v]) => {
          if (v === '' || v === undefined || v === null) return;
          if (c.filterStyle === 'bracket') {
            qs.set(`filter[${k}]`, String(v));
          } else {
            qs.set(k, String(v));
          }
        });
      }
    }

    const qsStr = qs.toString();
    const basePath = (c as any).abpStyle ? `${API_BASE}/${c.path}/GetAll` : `${API_BASE}/${c.path}`;
    try {
      const raw = await request<unknown>(`${basePath}${qsStr ? `?${qsStr}` : ""}`);
      // ABP wraps response in { result: { items, totalCount } }
      const unwrapped = (raw as any)?.result ?? raw;
      return unwrapList<T>(unwrapped);
    } catch (err: unknown) {
      if (!(err instanceof Error) || !/HTTP [45]\d{2}/.test(err.message)) throw err;
      // Filtreli istek hata verdiyse filtresiz veri gostermek yaniltir (ana-detay, arama) — hatayi goster
      if (filter && Object.values(filter).some((v) => v !== '' && v !== undefined && v !== null)) throw err;
      // Retry with pagination-only params
      if (pagination && c.pageParam) {
        try {
          const pqs = new URLSearchParams();
          pqs.set(c.pageParam, c.paginationStyle === 'offset-limit' ? String((pagination.page - 1) * pagination.perPage) : String(pagination.page));
          if (c.sizeParam) pqs.set(c.sizeParam, String(pagination.perPage));
          const raw = await request<unknown>(`${basePath}?${pqs.toString()}`);
          return unwrapList<T>(raw);
        } catch { /* fall through to bare URL */ }
      }
      // Last resort: bare URL without any params
      try {
        const raw = await request<unknown>(basePath);
        return unwrapList<T>(raw);
      } catch { throw err; }
    }
  },

  getOne: async <T>(resource: string, id: string | number): Promise<T> => {
    if (isAbp(resource)) {
      const raw = await request<unknown>(`${API_BASE}/${cfg(resource).path}/Get?Id=${id}`);
      return ((raw as any)?.result ?? raw) as T;
    }
    return request<T>(`${API_BASE}/${cfg(resource).path}/${id}`);
  },

  /** Is akisi eylemi (Gonder, Iptal...) — durum yalniz bununla degisir; backend gecis kurallarini uygular */
  changeStatus: async <T>(resource: string, id: string | number, action: string, comment?: string): Promise<T> => {
    const raw = await request<unknown>(`${API_BASE}/${cfg(resource).path}/ChangeStatus?id=${id}`, {
      method: 'POST',
      body: JSON.stringify({ action, actionData: comment ? { comment } : undefined }),
    });
    return ((raw as any)?.result ?? raw) as T;
  },

  create: async <T>(resource: string, data: unknown): Promise<T> => {
    if (isAbp(resource)) {
      const raw = await request<unknown>(`${API_BASE}/${cfg(resource).path}/Create`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return ((raw as any)?.result ?? raw) as T;
    }
    return request<T>(`${API_BASE}/${cfg(resource).path}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async <T>(resource: string, id: string | number, data: unknown): Promise<T> => {
    if (isAbp(resource)) {
      const raw = await request<unknown>(`${API_BASE}/${cfg(resource).path}/Update`, {
        method: 'PUT',
        body: JSON.stringify({ ...data as object, id }),
      });
      return ((raw as any)?.result ?? raw) as T;
    }
    const url = `${API_BASE}/${cfg(resource).path}/${id}`;
    if (!_etagCache.has(url)) {
      await fetch(url, { headers: { Accept: "application/json", ...authHeaders, ...CUSTOM_HEADERS } })
        .then(r => { const e = r.headers.get("etag"); if (e) _etagCache.set(url, e); })
        .catch(() => {});
    }
    return request<T>(url, { method: 'PUT', body: JSON.stringify(data) });
  },

  delete: async (resource: string, id: string | number): Promise<void> => {
    if (isAbp(resource)) {
      await request(`${API_BASE}/${cfg(resource).path}/Delete?Id=${id}`, {
        method: 'DELETE',
      });
      return;
    }
    const url = `${API_BASE}/${cfg(resource).path}/${id}`;
    if (!_etagCache.has(url)) {
      await fetch(url, { headers: { Accept: "application/json", ...authHeaders, ...CUSTOM_HEADERS } })
        .then(r => { const e = r.headers.get("etag"); if (e) _etagCache.set(url, e); })
        .catch(() => {});
    }
    await request(url, { method: 'DELETE' });
  },
};
