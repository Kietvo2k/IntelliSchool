import { describe, expect, it } from 'vitest';
import { renderMarkup } from '../lib/test-render.js';
import { RegistrationsPage } from './RegistrationsPage.js';

describe('RegistrationsPage Wizard', () => {
  it('renders step navigation for registrations management', () => {
    const markup = renderMarkup(<RegistrationsPage />, {
      user: { userId: 'owner-1', displayName: 'Hiệu trưởng', email: 'owner@test.local', role: 'SCHOOL_OWNER', schoolId: 'school-1' },
      route: '/app/registrations',
    });
    expect(markup).toContain('Yêu cầu đăng ký');
    expect(markup).toContain('1. Danh sách yêu cầu');
    expect(markup).toContain('2. Xử lý yêu cầu');
  });
});
