import { describe, expect, it, vi } from 'vitest';
import { ApiError, api, changePassword, getQueue } from '../api';

function problem(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/problem+json', ...headers } });
}

describe('staff API errors', () => {
  it('normalizes error metadata safely and reads the exposed request ID header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problem(400, {
      detail: 'sensitive response content',
      errors: ['username must be valid', 'private value is invalid'],
    }, { 'X-Request-Id': 'support-123' })));
    const error = await api('/staff/users').catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'http', status: 400, errors: ['username'], requestId: 'support-123' });
    expect((error as Error).message).not.toContain('sensitive response content');
    expect(JSON.stringify(error)).not.toContain('private value');
  });

  it('does not dispatch session expiry for an incorrect current password', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problem(401, { detail: 'Current password is incorrect' })));
    const expired = vi.fn();
    window.addEventListener('staff-session-expired', expired);
    const error = await changePassword('wrong', 'long-enough-password').catch((cause: unknown) => cause);
    window.removeEventListener('staff-session-expired', expired);
    expect(error).toMatchObject({ status: 401, incorrectCurrentPassword: true });
    expect(expired).not.toHaveBeenCalled();
  });

  it('classifies network and malformed success responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('private network detail')));
    const network = await api('/staff/summary').catch((cause: unknown) => cause);
    expect(network).toMatchObject({ kind: 'network', status: 0 });
    expect((network as Error).message).not.toContain('private network detail');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>failure</html>', { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const malformed = await api('/staff/summary').catch((cause: unknown) => cause);
    expect(malformed).toMatchObject({ kind: 'invalid-response', status: 200 });
  });

  it('aborts an API request at the configured timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const pending = api('/staff/summary').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(pending).resolves.toMatchObject({ kind: 'timeout', status: 0 });
  });
});

describe('staff queue search requests', () => {
  it('omits blank optional filters from the validated POST body and preserves false booleans', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], nextCursor: null }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await getQueue({ search: ' TEST ONLY resident ', status: '', documentTypeId: '', releaseDateFrom: '', releaseDateTo: '', overdue: false, limit: 25 });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(String(fetchMock.mock.calls[0][0])).toContain('/staff/requests/search');
    expect(JSON.parse(String(init.body))).toEqual({ overdue: false, limit: 25, search: 'TEST ONLY resident' });
  });
});
