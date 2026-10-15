export type Role = 'ADMINISTRATOR' | 'PROCESSOR';
export type Status = 'SUBMITTED' | 'UNDER_REVIEW' | 'PROCESSING' | 'READY_FOR_PICKUP' | 'RELEASED' | 'REJECTED' | 'CANCELLED';
export type Staff = { id: string; username: string; role: Role; isActive: boolean; mustChangePassword: boolean };
export type FieldDefinition = { key: string; label: string; type: 'text' | 'date' | 'select'; required: boolean; options?: string[] };
export type DocumentType = { id: string; slug: string; isActive: boolean; documentTypeVersionId: string; version: number; name: string; description: string; requirements: string[]; fields: FieldDefinition[] };
export type PublicDocumentType = Omit<DocumentType, 'isActive'>;
export type QueueItem = { id: string; reference: string; status: Status; fullName: string; contactNumber: string; expectedReleaseDate: string | null; readyAt: string | null; createdAt: string; version: number; documentTypeVersion: { name: string; version: number; documentTypeId: string } };
export type RequestHistory = { id: string; eventType: 'STATUS_CHANGED' | 'RELEASE_DATE_CHANGED'; fromStatus: Status | null; toStatus: Status | null; oldReleaseDate: string | null; newReleaseDate: string | null; publicMessage: string | null; reason: string | null; internalNote: string | null; createdAt: string; actor: { username: string; role: Role } | null };
export type RequestDetail = QueueItem & { address: string; applicantFields: Record<string, string>; releasedAt: string | null; publicStatusMessage: string | null; updatedAt: string; documentTypeVersion: { id: string; documentTypeId: string; version: number; name: string; description: string; requirements: string[]; fieldDefinitions: FieldDefinition[]; createdAt: string }; history: RequestHistory[] };
export type Page<T> = { data: T[]; nextCursor: string | null };
export type Summary = { pending: number; processing: number; ready: number; overdue: number };
export type AuditEvent = { id: string; actorId: string | null; action: string; targetType: string; targetId: string | null; before: unknown; after: unknown; createdAt: string; actor: { username: string; role: Role } | null };

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly code?: string;
  /** Sanitized validation property paths only; server-provided messages are never retained. */
  readonly errors: string[];
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;
  readonly incorrectCurrentPassword: boolean;
  constructor(options: { kind: ApiErrorKind; status?: number; code?: string; errors?: string[]; requestId?: string; retryAfterSeconds?: number; incorrectCurrentPassword?: boolean }) {
    super('API request failed'); this.name = 'ApiError'; this.kind = options.kind; this.status = options.status ?? 0;
    this.code = options.code; this.errors = options.errors ?? []; this.requestId = options.requestId;
    this.retryAfterSeconds = options.retryAfterSeconds; this.incorrectCurrentPassword = options.incorrectCurrentPassword ?? false;
  }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 20_000;
let csrfToken: string | null = null;
export const setCsrfToken = (token: string | null) => { csrfToken = token; };

function safeRequestId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value) ? value : undefined;
}

function validationPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    if (typeof item !== 'string') return [];
    const path = item.match(/^([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*)\b/)?.[1];
    const knownLeaves = new Set(['username', 'password', 'currentPassword', 'newPassword', 'slug', 'name', 'description', 'requirements', 'role', 'status', 'reason', 'publicMessage', 'internalNote', 'expectedReleaseDate', 'documentTypeId', 'search', 'releaseDateFrom', 'releaseDateTo', 'overdue', 'cursor', 'limit']);
    return path && (path.startsWith('fields.') || knownLeaves.has(path)) ? [path] : [];
  }))].slice(0, 50);
}

function retryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.ceil(seconds), 86_400);
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.min(Math.max(0, Math.ceil((date - Date.now()) / 1000)), 86_400);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<{ data: T; etag: string | null }> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json, application/problem+json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (method !== 'GET' && method !== 'HEAD' && !path.endsWith('/login') && csrfToken) headers.set('X-CSRF-Token', csrfToken);
  const controller = new AbortController();
  let timedOut = false;
  const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  init.signal?.addEventListener('abort', abortFromCaller, { once: true });
  if (init.signal?.aborted) controller.abort();
  let response!: Response;
  let contentType = '';
  let payload: unknown = null;
  let malformed = false;
  try {
    response = await fetch(`${apiBase}${path}`, { ...init, method, headers, signal: controller.signal, credentials: 'include' });
    contentType = response.headers.get('content-type') || '';
    if (response.status !== 204) {
      const text = await response.text();
      if (text) {
        try { payload = JSON.parse(text) as unknown; } catch { malformed = true; }
      } else if (response.ok) malformed = true;
    }
  } catch {
    throw new ApiError({ kind: timedOut ? 'timeout' : 'network' });
  } finally {
    window.clearTimeout(timeout);
    init.signal?.removeEventListener('abort', abortFromCaller);
  }
  if (!response.ok) {
    const problem = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const incorrectCurrentPassword = path.endsWith('/password') && problem.detail === 'Current password is incorrect';
    if (response.status === 401 && !path.endsWith('/login') && !path.endsWith('/me') && !incorrectCurrentPassword) window.dispatchEvent(new Event('staff-session-expired'));
    throw new ApiError({
      kind: 'http', status: response.status,
      code: typeof problem.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(problem.code) ? problem.code : undefined,
      errors: validationPaths(problem.errors),
      requestId: safeRequestId(problem.requestId) ?? safeRequestId(response.headers.get('X-Request-Id')),
      retryAfterSeconds: retryAfterSeconds(response.headers.get('Retry-After')),
      incorrectCurrentPassword,
    });
  }
  if (malformed || (response.status !== 204 && !contentType.includes('application/json'))) throw new ApiError({ kind: 'invalid-response', status: response.status });
  return { data: payload as T, etag: response.headers.get('ETag') };
}

export const getMe = () => api<{ staff: Staff; csrfToken: string }>('/staff/auth/me');
export const login = (username: string, password: string) => api<{ staff: Staff; csrfToken: string; expiresAt: string }>('/staff/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
export const logout = () => api<{ status: string }>('/staff/auth/logout', { method: 'POST', body: '{}' });
export const changePassword = (currentPassword: string, newPassword: string) => api<{ status: string; mustChangePassword: false }>('/staff/auth/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) });
export const getSummary = () => api<Summary>('/staff/summary');
export const getQueue = (filters: { status?: string; documentTypeId?: string; releaseDateFrom?: string; releaseDateTo?: string; overdue?: boolean; search?: string; cursor?: string; limit?: number }) => {
  const { search, ...rest } = filters;
  if (search?.trim()) return api<Page<QueueItem>>('/staff/requests/search', { method: 'POST', body: JSON.stringify({ ...rest, search: search.trim() }) });
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(rest)) if (value !== undefined && value !== '') query.set(key, String(value));
  return api<Page<QueueItem>>(`/staff/requests${query.size ? `?${query}` : ''}`);
};
export const getRequest = (id: string) => api<RequestDetail>(`/staff/requests/${id}`);
export const transitionRequest = (id: string, etag: string, body: unknown) => api(`/staff/requests/${id}/transitions`, { method: 'POST', headers: { 'If-Match': etag }, body: JSON.stringify(body) });
export const setReleaseDate = (id: string, etag: string, body: unknown) => api(`/staff/requests/${id}/release-date`, { method: 'PATCH', headers: { 'If-Match': etag }, body: JSON.stringify(body) });
export const getStaffCatalog = () => api<DocumentType[]>('/staff/document-types');
export const getPublicCatalog = () => api<PublicDocumentType[]>('/document-types');
export const createDocumentType = (body: unknown) => api<DocumentType>('/staff/document-types', { method: 'POST', body: JSON.stringify(body) });
export const updateDocumentType = (id: string, body: unknown) => api<DocumentType>(`/staff/document-types/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const setDocumentActive = (id: string, active: boolean) => api(`/staff/document-types/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST', body: '{}' });
export const getStaffUsers = () => api<Staff[]>('/staff/users');
export const createStaffUser = (body: unknown) => api<{ staff: Staff; temporaryPassword: string }>('/staff/users', { method: 'POST', body: JSON.stringify(body) });
export const updateStaffUser = (id: string, body: unknown) => api<Staff>(`/staff/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const resetStaffPassword = (id: string) => api<{ staffId: string; temporaryPassword: string; mustChangePassword: true }>(`/staff/users/${id}/reset-password`, { method: 'POST', body: '{}' });
export const getAuditEvents = (cursor?: string) => api<Page<AuditEvent>>(`/staff/audit-events?limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
