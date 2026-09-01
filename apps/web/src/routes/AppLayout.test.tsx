import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SessionContext } from '../lib/SessionContext.js';
import type { SessionUser } from '../lib/session.js';
import { AppQueryProvider } from '../lib/query.js';
import { AppLayout } from './AppLayout.js';

function renderLayout(user: SessionUser): string {
  return renderToStaticMarkup(
    <AppQueryProvider>
      <MemoryRouter initialEntries={['/app']}>
        <SessionContext.Provider value={{ user, logout: () => undefined }}>
          <AppLayout />
        </SessionContext.Provider>
      </MemoryRouter>
    </AppQueryProvider>,
  );
}

const baseUser = {
  userId: 'user-1',
  email: 'user@example.test',
  displayName: 'Người dùng thử nghiệm',
  schoolId: 'school-a',
} as const;

describe('routed workspace navigation', () => {
  it('only shows platform administration routes to a platform admin', () => {
    const markup = renderLayout({ ...baseUser, role: 'PLATFORM_ADMIN', schoolId: undefined });
    expect(markup).toContain('Duyệt trường');
    expect(markup).not.toContain('Ngân hàng câu hỏi');
    expect(markup).not.toContain('Điểm của em');
  });

  it('shows school management and LMS routes to a school owner', () => {
    const markup = renderLayout({ ...baseUser, role: 'SCHOOL_OWNER' });
    expect(markup).toContain('Lớp &amp; giáo viên');
    expect(markup).toContain('Duyệt đăng ký');
    expect(markup).toContain('Skill nháp');
    expect(markup).not.toContain('>Thêm<');
    expect(markup).toContain('Bài giảng');
    expect(markup).toContain('Ngân hàng câu hỏi');
    expect(markup).toContain('Sổ điểm');
    expect(markup).toContain('Báo cáo tiến độ');
    expect(markup).not.toContain('Duyệt trường');
  });

  it('limits teachers to their teaching workspace', () => {
    const markup = renderLayout({ ...baseUser, role: 'TEACHER' });
    expect(markup).toContain('Bài giảng');
    expect(markup).toContain('Ngân hàng');
    expect(markup).toContain('Bài tập');
    expect(markup).toContain('Sổ điểm');
    expect(markup).toContain('tiến độ');
    expect(markup).toContain('Lớp');
    expect(markup).toContain('Thi');
    expect(markup).toContain('Soạn bài AI');
    expect(markup).not.toContain('Trợ giảng');
    expect(markup).not.toContain('Danh mục nghề');
    expect(markup).toContain('Skill nháp');
    expect(markup).not.toContain('Cấu hình AI');
    expect(markup).not.toContain('Lớp &amp; giáo viên');
    expect(markup).not.toContain('Duyệt trường');
    expect(markup).not.toContain('Khám phá');
  });

  it('shows the homeroom roster to a homeroom teacher', () => {
    const markup = renderLayout({ ...baseUser, role: 'TEACHER', homeroomClassIds: ['class-1'] });
    expect(markup).toContain('Học sinh chủ nhiệm');
    expect(markup).toContain('Tin nhắn');
    expect(markup).toContain('Skill nháp');
    expect(markup).toContain('href="/app/homeroom"');
  });

  it('only shows personal learning routes to a student', () => {
    const markup = renderLayout({ ...baseUser, role: 'STUDENT' });
    expect(markup).toContain('Bài giảng');
    expect(markup).toContain('Bài tập');
    expect(markup).toContain('Điểm của em');
    expect(markup).toContain('Khám phá');
    expect(markup).toContain('Tin nhắn');
    expect(markup).toContain('AI học tập');
    expect(markup).toContain('href="/app/ai-study"');
    expect(markup).not.toContain('Trợ giảng');
    expect(markup).not.toContain('Sổ điểm');
    expect(markup).not.toContain('Báo cáo tiến độ');
    expect(markup).not.toContain('Ngân hàng câu hỏi');
    expect(markup).not.toContain('Giám thị thi thử');
  });

  it('offers a skip link and a labelled mobile navigation trigger', () => {
    const markup = renderLayout({ ...baseUser, role: 'STUDENT' });

    expect(markup).toContain('href="#main-content"');
    expect(markup).toContain('Đi tới nội dung chính');
    expect(markup).toContain('Mở điều hướng');
  });
});
