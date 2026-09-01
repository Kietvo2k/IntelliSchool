import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthPage } from './AuthPage.js';

describe('AuthPage', () => {
  it('marks navigation links as touch targets', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/auth/register']}>
        <AuthPage onAuthenticated={() => undefined} />
      </MemoryRouter>,
    );
    expect(markup).toContain('class="brand auth-link"');
    expect((markup.match(/class="auth-link"/g) ?? []).length).toBe(3);
    expect(markup).not.toContain('href="/auth/register"');
  });
});
