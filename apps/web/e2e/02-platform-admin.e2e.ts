import { expect, test } from '@playwright/test';
import { seedAccounts, login } from './fixtures.js';

/** Luồng (b): admin nền tảng quản lý trường, người dùng và nhật ký bảo mật. */
test.describe('Admin nền tảng', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, seedAccounts.platformAdmin);
  });

  test('xem danh sách trường và người dùng', async ({ page }) => {
    await page.getByRole('link', { name: 'Trường học' }).click();
    await expect(page.getByRole('heading', { name: 'Danh sách trường' })).toBeVisible();

    await page.getByRole('link', { name: 'Người dùng' }).click();
    await expect(page.getByRole('heading', { name: 'Quản lý người dùng' })).toBeVisible();
  });

  test('nhật ký bảo mật có bộ lọc và phân trang', async ({ page }) => {
    await page.getByRole('link', { name: 'Nhật ký bảo mật' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
