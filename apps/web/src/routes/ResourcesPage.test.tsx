import { describe, expect, it } from 'vitest';
import { renderMarkup } from '../lib/test-render.js';
import { ResourcesPage } from './ResourcesPage.js';

describe('ResourcesPage', () => {
  it('offers an educator a safe upload form and status-aware resource list', () => {
    const markup = renderMarkup(<ResourcesPage />, {
      user: { userId: 'teacher-1', displayName: 'Cô An', email: 'teacher@example.test', role: 'TEACHER', schoolId: 'school-1' },
    });
    expect(markup).toContain('Thư viện số');
    expect(markup).not.toContain('Tài nguyên học tập');
    expect(markup).toContain('Tải tài liệu lên');
    expect(markup).toContain('Tệp mới được cách ly và quét');
  });
});
