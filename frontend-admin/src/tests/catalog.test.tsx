import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App';
import { AuthProvider } from '../auth/AuthProvider';

const adminSession = { staff: { id: 'admin-1', username: 'admin', role: 'ADMINISTRATOR', mustChangePassword: false }, csrfToken: 'csrf-test' };
const documentType = (name: string) => ({
  id: 'document-1', slug: 'certificate', isActive: true, documentTypeVersionId: 'version-1', version: 1,
  name, description: 'Original description', requirements: ['Proof of identity'], fields: [],
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } });
}

function CatalogTestApp({ initialPath = '/catalog/document-1/edit' }: { initialPath?: string }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  return <QueryClientProvider client={client}><AuthProvider><MemoryRouter initialEntries={[initialPath]}><CatalogRefreshButton /><AppRoutes /></MemoryRouter></AuthProvider></QueryClientProvider>;
}

function CatalogRefreshButton() {
  const client = useQueryClient();
  return <button type="button" onClick={() => void client.invalidateQueries({ queryKey: ['staff-catalog'] })}>Refresh catalog data</button>;
}

describe('staff catalog editor', () => {
  it('loads asynchronously and preserves unsaved draft values when refreshed data changes', async () => {
    let catalogReads = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/staff/auth/me')) return json(adminSession);
      if (url.endsWith('/staff/document-types')) {
        catalogReads += 1;
        return json([documentType(catalogReads === 1 ? 'Server name' : 'Refreshed server name')]);
      }
      throw new Error(`Unexpected request ${url}`);
    }));
    const user = userEvent.setup();
    render(<CatalogTestApp />);

    const name = await screen.findByDisplayValue('Server name');
    const description = screen.getByDisplayValue('Original description');
    await user.clear(name);
    await user.type(name, 'Unsaved staff draft');
    await user.clear(description);
    await user.type(description, 'Unsaved description');
    await user.click(screen.getByRole('button', { name: 'Refresh catalog data' }));

    await waitFor(() => expect(catalogReads).toBe(2));
    expect(screen.getByDisplayValue('Unsaved staff draft')).toBeTruthy();
    expect(screen.getByDisplayValue('Unsaved description')).toBeTruthy();
  });

  it('shows a catalog load error and retries the request', async () => {
    let catalogReads = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/staff/auth/me')) return json(adminSession);
      if (url.endsWith('/staff/document-types')) {
        catalogReads += 1;
        return catalogReads === 1 ? json({ requestId: 'catalog-error-1' }, 503) : json([documentType('Recovered catalog')]);
      }
      throw new Error(`Unexpected request ${url}`);
    }));
    const user = userEvent.setup();
    render(<CatalogTestApp />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByDisplayValue('Recovered catalog')).toBeTruthy();
    expect(catalogReads).toBe(2);
  });
});
