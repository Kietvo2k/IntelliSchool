import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SkillGraphsPage } from './SkillGraphsPage.js';
import { SessionContext } from '../lib/SessionContext.js';

describe('SkillGraphsPage', () => {
  it('renders the skill graph authoring workspace with four-eyes guidance', () => {
    const markup = renderToStaticMarkup(
      <SessionContext.Provider value={{ user: { userId: 't1', role: 'TEACHER', schoolId: 's1', email: 't@e.test', displayName: 'Cô An' }, logout: () => undefined }}>
        <SkillGraphsPage />
      </SessionContext.Provider>,
    );
    expect(markup).toContain('Đồ thị kỹ năng');
    expect(markup).toContain('Tạo bản nháp');
    expect(markup).toContain('Quan hệ tiên quyết');
    expect(markup).toContain('không thể tự duyệt đồ thị do chính mình soạn');
  });
});
