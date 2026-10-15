export type FieldDefinition = {
  key: string;
  label: string;
  type: 'text' | 'date' | 'select';
  required: boolean;
  options?: string[];
};

export type DocumentType = {
  id: string;
  slug: string;
  documentTypeVersionId: string;
  version: number;
  name: string;
  description: string;
  requirements: string[];
  fields: FieldDefinition[];
};

export type SubmissionResult = {
  reference: string;
  trackingCredential: string;
  message: string;
};

export type TrackedRequest = {
  reference: string;
  documentName: string;
  status: RequestStatus;
  submittedAt: string;
  expectedReleaseDate: string | null;
  readyAt: string | null;
  releasedAt: string | null;
  statusMessage: string | null;
};

export type RequestStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'PROCESSING'
  | 'READY_FOR_PICKUP'
  | 'RELEASED'
  | 'REJECTED'
  | 'CANCELLED';

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly code?: string;
  /** Sanitized validation property paths only; server-provided messages are never retained. */
  readonly errors: string[];
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;

  constructor(options: {
    kind: ApiErrorKind;
    status?: number;
    code?: string;
    errors?: string[];
    requestId?: string;
    retryAfterSeconds?: number;
  }) {
    super('API request failed');
    this.name = 'ApiError';
    this.kind = options.kind;
    this.status = options.status ?? 0;
    this.code = options.code;
    this.errors = options.errors ?? [];
    this.requestId = options.requestId;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 20_000;

function safeRequestId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value) ? value : undefined;
}

function validationPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    if (typeof item !== 'string') return [];
    const path = item.match(/^([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*)\b/)?.[1];
    const knownLeaf = new Set(['fullName', 'contactNumber', 'address', 'reference', 'trackingCredential', 'documentTypeId']);
    return path && (path.startsWith('applicant.') || path.startsWith('fields.') || knownLeaf.has(path)) ? [path] : [];
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

export async function publicApi<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    response = await fetch(`${apiBase}${path}`, {
      ...init,
      signal: controller.signal,
      credentials: 'omit',
      headers: {
        Accept: 'application/json, application/problem+json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
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
    throw new ApiError({
      kind: 'http', status: response.status,
      code: typeof problem.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(problem.code) ? problem.code : undefined,
      errors: validationPaths(problem.errors),
      requestId: safeRequestId(problem.requestId) ?? safeRequestId(response.headers.get('X-Request-Id')),
      retryAfterSeconds: retryAfterSeconds(response.headers.get('Retry-After')),
    });
  }
  if (malformed || (response.status !== 204 && !contentType.includes('application/json'))) {
    throw new ApiError({ kind: 'invalid-response', status: response.status });
  }
  return payload as T;
}

export const listDocumentTypes = () => publicApi<DocumentType[]>('/document-types');

export const submitRequest = (serializedBody: string, idempotencyKey: string) => publicApi<SubmissionResult>('/requests', {
  method: 'POST',
  headers: { 'Idempotency-Key': idempotencyKey },
  body: serializedBody,
});

export const trackRequest = (reference: string, trackingCredential: string) => publicApi<TrackedRequest>('/requests/track', {
  method: 'POST',
  body: JSON.stringify({ reference, trackingCredential }),
});

export function formatManilaDate(value: string | null, locale: string): string {
  if (!value) return '—';
  // Date-only values are interpreted at midnight in the API's Asia/Manila timezone.
  const date = new Date(`${value.slice(0, 10)}T00:00:00+08:00`);
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'Asia/Manila' }).format(date);
}

export function formatManilaDateTime(value: string | null, locale: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
  }).format(new Date(value));
}
