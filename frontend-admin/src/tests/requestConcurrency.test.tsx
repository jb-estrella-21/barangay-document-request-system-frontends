import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App';
import { AuthProvider } from '../auth';

const staffSession = { staff: { id: 'staff-1', username: 'processor', role: 'PROCESSOR', isActive: true, mustChangePassword: false }, csrfToken: 'csrf-value' };
const requestDetail = (version: number) => ({
  id: 'request-1', reference: 'REQ-2026-123456', status: 'SUBMITTED', fullName: 'Resident', contactNumber: '09171234567',
  expectedReleaseDate: null, readyAt: null, createdAt: '2026-10-14T10:00:00.000Z', version,
  documentTypeVersion: { name: 'Certificate', version: 1, documentTypeId: 'doc-1', id: 'doc-version-1', description: '', requirements: [], fieldDefinitions: [], createdAt: '2026-10-14T00:00:00.000Z' },
  address: 'Barangay address', applicantFields: {}, releasedAt: null, publicStatusMessage: null, updatedAt: '2026-10-14T10:00:00.000Z', history: [],
});
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json', ...headers } });

describe('staff request concurrency recovery', () => {
  it('refreshes after a stale-version conflict and retains If-Match on the attempted mutation', async () => {
    let reads = 0;
    let transitionHeaders: Headers | undefined;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/staff/auth/me')) return json(staffSession);
      if (url.endsWith('/staff/requests/request-1')) {
        reads += 1;
        const version = reads === 1 ? 2 : 3;
        return json(requestDetail(version), 200, { ETag: `"${version}"` });
      }
      if (url.endsWith('/staff/requests/request-1/transitions')) {
        transitionHeaders = new Headers(init?.headers);
        return json({ detail: 'stale version', requestId: 'conflict-1' }, 409);
      }
      throw new Error(`Unexpected request ${url}`);
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();
    render(<QueryClientProvider client={client}><AuthProvider><MemoryRouter initialEntries={['/requests/request-1']}><AppRoutes /></MemoryRouter></AuthProvider></QueryClientProvider>);
    await screen.findByRole('heading', { name: 'REQ-2026-123456' });
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(reads).toBe(2));
    expect(transitionHeaders?.get('If-Match')).toBe('"2"');
    expect(screen.getByText('v3')).toBeTruthy();
    expect(screen.getByText(/record changed or the requested action is no longer valid/i)).toBeTruthy();
  });
});
