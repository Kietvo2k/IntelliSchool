import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AiKnowledgePage } from './AiKnowledgePage.js';

describe('AiKnowledgePage', () => {
  it('renders the ingestion form and empty state', () => {
    const markup = renderToStaticMarkup(<AiKnowledgePage />);
    expect(markup).toContain('Kho tri thức cho AI');
    expect(markup).toContain('Nạp tài liệu mới');
    expect(markup).toContain('Dán văn bản');
  });
});
