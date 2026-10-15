import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmationPage, RequestPage } from '../App';
import { clearSubmissionMemory, markSubmissionUncertain } from '../submissionState';

const documentType = {
  id: 'doc-1', slug: 'certificate', documentTypeVersionId: 'version-1', version: 1,
  name: 'Barangay Certificate', description: 'A certificate', requirements: [], fields: [],
};

function RouteStateProbe() {
  const location = useLocation();
  return <output data-testid="route-state">{JSON.stringify(location.state)}</output>;
}

function renderRequestPage(path = '/request/certificate') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><RouteStateProbe /><Routes>
    <Route path="/request/:slug" element={<RequestPage />} />
    <Route path="/request/submitted" element={<ConfirmationPage />} />
  </Routes></MemoryRouter></QueryClientProvider>);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => clearSubmissionMemory());

describe('resident request flow', () => {
  it('retries an uncertain submission with the exact same body and key, then keeps the credential out of browser state', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let submissions = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith('/document-types')) return jsonResponse([documentType]);
      if (url.endsWith('/requests')) {
        submissions += 1;
        if (submissions === 1) throw new TypeError('connection detail must not be shown');
        return jsonResponse({ reference: 'REQ-2026-123456', trackingCredential: 'secret-track-credential', message: 'submitted' }, 201);
      }
      throw new Error(`Unexpected request ${url}`);
    }));

    const user = userEvent.setup();
    renderRequestPage();
    await user.type(await screen.findByRole('textbox', { name: 'Full name' }), 'Resident Example');
    await user.type(screen.getByRole('textbox', { name: 'Contact number' }), '09171234567');
    await user.type(screen.getByRole('textbox', { name: 'Home address' }), '12 Sample Street');
    await user.click(screen.getByRole('button', { name: /Send request/ }));

    const retryButton = await screen.findByRole('button', { name: 'Retry the same request' });
    expect(submissions).toBe(1);
    const firstPost = calls.find((call) => call.url.endsWith('/requests'))!;
    const firstBody = firstPost.init?.body;
    const firstKey = new Headers(firstPost.init?.headers).get('Idempotency-Key');
    const marker = window.sessionStorage.getItem('barangay-public-submission-uncertain-v1');
    expect(marker).not.toContain('Resident Example');
    expect(marker).not.toContain('secret-track-credential');
    expect(marker).toMatch(/^\{"createdAt":\d+\}$/);

    await user.click(retryButton);
    expect(await screen.findByText('secret-track-credential')).toBeTruthy();
    const posts = calls.filter((call) => call.url.endsWith('/requests'));
    expect(posts).toHaveLength(2);
    expect(posts[1].init?.body).toBe(firstBody);
    expect(new Headers(posts[1].init?.headers).get('Idempotency-Key')).toBe(firstKey);
    expect(screen.getByTestId('route-state').textContent).toBe('null');
    expect(window.location.href).not.toContain('secret-track-credential');
    expect(window.sessionStorage.length).toBe(0);
    expect(window.localStorage.length).toBe(0);
  });

  it('blocks a new request after reload until the resident explicitly acknowledges the uncertain outcome', async () => {
    markSubmissionUncertain(Date.now());
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/document-types')) return jsonResponse([documentType]);
      throw new Error('A request must not be submitted before acknowledgement');
    }));
    const user = userEvent.setup();
    renderRequestPage();
    const fullName = await screen.findByRole('textbox', { name: 'Full name' });
    expect((fullName as HTMLInputElement).matches(':disabled')).toBe(true);
    expect((screen.getByRole('button', { name: 'Send request' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'I understand; start a new request' }));
    await waitFor(() => expect((fullName as HTMLInputElement).matches(':disabled')).toBe(false));
    expect(window.sessionStorage.length).toBe(0);
  });

  it('shows a safe fallback on a direct confirmation visit without an in-memory handoff', () => {
    render(<MemoryRouter initialEntries={['/request/submitted']}><Routes><Route path="/request/submitted" element={<ConfirmationPage />} /></Routes></MemoryRouter>);
    expect(screen.getByText(/available only in the active tab/)).toBeTruthy();
    expect(screen.queryByText('secret-track-credential')).toBeNull();
  });
});
