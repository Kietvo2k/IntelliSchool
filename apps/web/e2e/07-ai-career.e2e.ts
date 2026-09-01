import { expect, test } from '@playwright/test';
import { seedAccounts, login } from './fixtures.js';

test.describe('AI học tập & hướng nghiệp', () => {
  test('AI tự truy hồi tài liệu và hiển thị kết quả trong khung chat', async ({ page }) => {
    await login(page, seedAccounts.studentMinh);
    await page.getByRole('link', { name: 'AI học tập' }).click();
    await expect(page.getByRole('heading', { name: 'AI học tập' })).toBeVisible();
    await expect(page.getByText('AI tự chọn tài liệu')).toBeVisible();
    await page.getByRole('textbox', { name: 'Tin nhắn' }).fill('Giải thích ngắn gọn đạo hàm là gì');
    await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
    await expect(page.locator('[role="log"]')).toContainText(/đạo hàm|tài liệu|kiến thức chung/i, { timeout: 20_000 });
  });

  test('quiz hướng nghiệp không cho nhảy tới bước chưa hoàn thành', async ({ page }) => {
    await login(page, seedAccounts.studentMinh);
    await page.getByRole('link', { name: 'Khám phá' }).click();
    await expect(page.getByRole('heading', { name: 'Khám phá bản thân' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hồ sơ', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Bắt đầu' }).click();
    await expect(page.getByRole('heading', { name: 'Năng lực SCDP' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hồ sơ', exact: true })).toBeDisabled();
  });
});
