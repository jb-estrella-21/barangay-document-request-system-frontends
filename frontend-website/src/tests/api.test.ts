import { describe, expect, it, vi } from 'vitest';
import { ApiError, publicApi } from '../api';

describe('public API errors', () => {
  it('normalizes Problem Details without retaining raw detail or validation messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 400,
      detail: 'sensitive server detail',
      errors: ['applicant.fullName must be at least 2 characters', 'secret-value is invalid'],
      requestId: 'body-request-123',
    }), { status: 400, headers: { 'Content-Type': 'application/problem+json' } })));

    const error = await publicApi('/requests').catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, kind: 'http', requestId: 'body-request-123', errors: ['applicant.fullName'] });
    expect((error as Error).message).not.toContain('sensitive server detail');
    expect(JSON.stringify(error)).not.toContain('secret-value');
  });

  it('falls back to the exposed request ID header and parses Retry-After', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', {
      status: 429,
      headers: { 'Content-Type': 'application/problem+json', 'X-Request-Id': 'header-request-456', 'Retry-After': '8' },
    })));

    const error = await publicApi('/requests').catch((cause: unknown) => cause);
    expect(error).toMatchObject({ status: 429, requestId: 'header-request-456', retryAfterSeconds: 8 });
  });

  it('classifies network and malformed successful responses without exposing fetch details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('private network detail')));
    const network = await publicApi('/requests').catch((cause: unknown) => cause);
    expect(network).toMatchObject({ kind: 'network', status: 0 });
    expect((network as Error).message).not.toContain('private network detail');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const malformed = await publicApi('/document-types').catch((cause: unknown) => cause);
    expect(malformed).toMatchObject({ kind: 'invalid-response', status: 200 });
  });

  it('aborts a request at the configured timeout and reports an uncertain timeout kind', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const pending = publicApi('/requests').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(pending).resolves.toMatchObject({ kind: 'timeout', status: 0 });
  });
});
