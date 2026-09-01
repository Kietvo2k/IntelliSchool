import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PathScrollRestoration } from './PathScrollRestoration.js';

describe('PathScrollRestoration', () => {
  it('renders under MemoryRouter without throwing', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <PathScrollRestoration />
        <p>ok</p>
      </MemoryRouter>,
    );
    expect(markup).toContain('ok');
  });
});
