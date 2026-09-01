import { expect, test } from '@playwright/test';
import { seedAccounts, login } from './fixtures.js';

/** Luồng (c): giáo viên có bài giảng/tài nguyên; học sinh xem được bài giảng. */
test.describe('Bài giảng & tài nguyên', () => {
  test('giáo viên mở trang bài giảng và tài nguyên', async ({ page }) => {
    await login(page, seedAccounts.teacherToan);
    await page.getByRole('link', { name: 'Bài giảng' }).click();
    await expect(page.getByRole('heading', { name: 'Bài giảng theo lớp' })).toBeVisible();
    await page.getByRole('link', { name: 'Thư viện số' }).click();
    await expect(page.getByRole('heading', { name: 'Thư viện số' })).toBeVisible();
  });

  test('học sinh xem được danh sách bài giảng đã xuất bản', async ({ page }) => {
    await login(page, seedAccounts.studentMinh);
    await page.getByRole('link', { name: 'Bài giảng' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
