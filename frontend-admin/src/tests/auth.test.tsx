import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App';
import { AuthProvider, useAuth } from '../auth';

const processorSession = { staff: { id: 'staff-1', username: 'processor', role: 'PROCESSOR', isActive: true, mustChangePassword: false }, csrfToken: 'csrf-memory-only' };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } });
}

function AuthProbe() {
  const auth = useAuth();
  return <div><output data-testid="auth-status">{auth.status}</output><output data-testid="staff-name">{auth.staff?.username || ''}</output><output data-testid="logout-error">{auth.logoutError ? 'logout error' : ''}</output><button type="button" onClick={() => void auth.signOut()}>sign out</button><button type="button" onClick={() => void auth.retryRestore()}>retry restore</button></div>;
}

function renderAuthProbe() {
  return render(<AuthProvider><MemoryRouter><AuthProbe /></MemoryRouter></AuthProvider>);
}

describe('staff session lifecycle', () => {
  it('keeps service outages distinct from an anonymous session and offers restoration retry', async () => {
    let attempts = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError('connection detail');
      return response({ detail: 'must not be shown', requestId: 'restore-123' }, 401);
    }));
    const user = userEvent.setup();
    render(<AuthProvider><MemoryRouter><AppRoutes /></MemoryRouter></AuthProvider>);
    expect(await screen.findByText(/could not reach the service/i)).toBeTruthy();
    expect(screen.queryByText('connection detail')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Staff sign in' })).toBeTruthy();
  });

  it('reconciles a failed logout with /me and keeps the session visible when it remains valid', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith('/staff/auth/me')) return response(processorSession);
      if (url.endsWith('/staff/auth/logout')) return response({ detail: 'raw logout failure', requestId: 'logout-123' }, 500);
      throw new Error(`Unexpected request ${url}`);
    }));
    const user = userEvent.setup();
    renderAuthProbe();
    await waitFor(() => expect(screen.getByTestId('auth-status').textContent).toBe('authenticated'));
    await user.click(screen.getByRole('button', { name: 'sign out' }));
    await waitFor(() => expect(screen.getByTestId('logout-error').textContent).toBe('logout error'));
    expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
    const logoutCall = calls.find((call) => call.url.endsWith('/staff/auth/logout'))!;
    expect(logoutCall.init?.credentials).toBe('include');
    expect(new Headers(logoutCall.init?.headers).get('X-CSRF-Token')).toBe('csrf-memory-only');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('clears local auth after confirmed session expiry during logout', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/staff/auth/me')) return response(processorSession);
      return response({ detail: 'expired' }, 401);
    }));
    const user = userEvent.setup();
    renderAuthProbe();
    await waitFor(() => expect(screen.getByTestId('auth-status').textContent).toBe('authenticated'));
    await user.click(screen.getByRole('button', { name: 'sign out' }));
    await waitFor(() => expect(screen.getByTestId('auth-status').textContent).toBe('anonymous'));
    expect(screen.getByTestId('staff-name').textContent).toBe('');
  });

  it('enforces the administrator route gate for processor accounts', async () => {
    const calls: string[] = [];
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/staff/auth/me')) return response(processorSession);
      if (url.endsWith('/staff/summary')) return response({ pending: 0, processing: 0, ready: 0, overdue: 0 });
      throw new Error(`Unexpected request ${url}`);
    }));
    render(<QueryClientProvider client={client}><AuthProvider><MemoryRouter initialEntries={['/catalog']}><AppRoutes /></MemoryRouter></AuthProvider></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Document catalog' })).toBeNull();
    expect(calls.some((url) => url.endsWith('/staff/document-types'))).toBe(false);
  });
});
