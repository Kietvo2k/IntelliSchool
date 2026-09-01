import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AiAssistantPage } from './AiAssistantPage.js';
import { SessionContext } from '../lib/SessionContext.js';

function render(role: 'SCHOOL_OWNER' | 'TEACHER' | 'STUDENT') {
  return renderToStaticMarkup(
    <SessionContext.Provider value={{ user: { userId: 'u1', role, schoolId: 's1', email: 'u@e.test', displayName: 'U' }, logout: () => undefined }}>
      <AiAssistantPage />
    </SessionContext.Provider>,
  );
}

describe('AiAssistantPage', () => {
  it('shows personal-study copy for students, not assistant branding', () => {
    const markup = render('STUDENT');
    expect(markup).toContain('AI học tập');
    expect(markup).toContain('kiến thức chung');
    expect(markup).toContain('không đưa đáp án trực tiếp');
    expect(markup).toContain('Gửi câu hỏi');
    expect(markup).not.toContain('Hỏi đáp cùng trợ giảng');
    expect(markup).not.toContain('Trợ giảng');
    expect(markup).toContain('Thinking');
    expect(markup).toContain('Agentic');
    expect(markup).toContain('Nguồn thư viện');
    expect(markup).toContain('Đính kèm tài liệu');
  });

  it('renders soạn bài AI for teachers', () => {
    const markup = render('TEACHER');
    expect(markup).toContain('Soạn bài AI');
    expect(markup).toContain('Phiên mới');
    expect(markup).not.toContain('Trợ giảng');
  });
});
