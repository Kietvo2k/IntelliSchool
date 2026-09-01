import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SessionContext } from './SessionContext.js';
import type { SessionUser } from './session.js';

export function renderMarkup(ui: ReactNode, options: { user?: SessionUser; route?: string } = {}): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const inner = options.user
    ? <SessionContext.Provider value={{ user: options.user, updateUser: () => undefined, logout: () => undefined }}>{ui}</SessionContext.Provider>
    : ui;
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[options.route ?? '/app']}>{inner}</MemoryRouter>
    </QueryClientProvider>,
  );
}
