import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RichTextEditor } from './RichTextEditor.js';

describe('RichTextEditor', () => {
  it('renders a labelled word-like toolbar and editable surface', () => {
    const markup = renderToStaticMarkup(<RichTextEditor label="Bài làm" value={{ html: '<p>Xin chào</p>', text: 'Xin chào' }} onChange={() => undefined} />);
    expect(markup).toContain('Bài làm');
    expect(markup).toContain('Đậm');
    expect(markup).toContain('Danh sách');
    expect(markup).toContain('contentEditable="true"');
  });
});
