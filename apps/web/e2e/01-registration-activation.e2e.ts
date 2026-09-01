import { expect, test } from '@playwright/test';
import { seedAccounts, login } from './fixtures.js';

/**
 * Luồng (a): đăng ký trường công khai + hiệu trưởng duyệt đăng ký giáo viên/học sinh.
 * Kích hoạt qua Mailpit được kiểm ở bước thủ công (link một lần trong email);
 * ở đây xác nhận yêu cầu công khai được ghi nhận và luồng duyệt của owner hoạt động.
 */
test.describe('Đăng ký & kích hoạt', () => {
  test('gửi yêu cầu mở trường công khai', async ({ page }) => {
    await page.goto('/auth/school-request');
    const suffix = Date.now();
    await page.getByLabel('Tên trường').fill(`THPT E2E ${suffix}`);
    await page.getByLabel('Họ tên hiệu trưởng').fill('Nguyễn Văn E2E');
    await page.getByLabel('Email công việc').fill(`e2e+${suffix}@truong.edu.vn`);
    await page.getByLabel('Tỉnh / thành phố').fill('Đà Nẵng');
    await page.getByRole('button', { name: /Gửi yêu cầu mở trường/ }).click();
    await expect(page.getByRole('status')).toContainText('Đã gửi yêu cầu');
  });

  test('hiệu trưởng xem được hàng đợi duyệt đăng ký', async ({ page }) => {
    await login(page, seedAccounts.ownerNguyenDu);
    await page.getByRole('link', { name: 'Duyệt đăng ký' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
