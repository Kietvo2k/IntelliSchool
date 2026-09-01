import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AiSettingsPage } from './AiSettingsPage.js';
import { SessionContext } from '../lib/SessionContext.js';

function render(role: 'SCHOOL_OWNER' | 'TEACHER') {
  return renderToStaticMarkup(
    <SessionContext.Provider value={{ user: { userId: 'u1', role, schoolId: 's1', email: 'u@e.test', displayName: 'U' }, logout: () => undefined }}>
      <AiSettingsPage />
    </SessionContext.Provider>,
  );
}

describe('AiSettingsPage', () => {
  it('explains keys stay in server env and shows add form for owners only', () => {
    const owner = render('SCHOOL_OWNER');
    expect(owner).toContain('Cấu hình AI');
    expect(owner).toContain('biến môi trường máy chủ');
    expect(owner).toContain('Thêm model');
    expect(render('TEACHER')).not.toContain('Thêm model');
  });
});
