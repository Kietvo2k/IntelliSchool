import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SchoolsPage } from './SchoolsPage.js';

describe('SchoolsPage', () => {
  it('provides a platform-admin view for school listing and safe details', () => {
    const markup = renderToStaticMarkup(<SchoolsPage />);

    expect(markup).toContain('Danh sách trường');
    expect(markup).toContain('Tải danh sách trường');
    expect(markup).toContain('không hiển thị bài làm, đáp án hoặc nội dung học tập');
    expect(markup).not.toContain('UUID');
  });
});
