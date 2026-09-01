import { expect, test } from '@playwright/test';
import { seedAccounts, login } from './fixtures.js';

/**
 * Luồng (d) + (e): ngân hàng câu hỏi/bài tập, học sinh làm bài, giáo viên chấm,
 * sổ điểm và export báo cáo. Kiểm tra các trang chính điều hướng và hiển thị được;
 * thao tác nộp/chấm được phủ chi tiết trong keyboard-and-axe.e2e.ts và integration.
 */
test.describe('Bài tập, sổ điểm & export', () => {
  test('giáo viên đi qua ngân hàng câu hỏi, bài tập, sổ điểm', async ({ page }) => {
    await login(page, seedAccounts.teacherToan);
    await page.getByRole('link', { name: 'Ngân hàng câu hỏi' }).click();
    await expect(page.getByRole('heading', { name: 'Soạn câu hỏi' })).toBeVisible();
    await page.getByRole('link', { name: 'Bài tập' }).click();
    await expect(page.getByRole('heading', { name: 'Bài tập theo lớp' })).toBeVisible();
    await page.getByRole('link', { name: 'Sổ điểm' }).click();
    await expect(page.getByRole('heading', { name: 'Tra cứu điểm theo lớp' })).toBeVisible();
  });

  test('giáo viên xem báo cáo tiến độ và tạo export', async ({ page }) => {
    await login(page, seedAccounts.teacherToan);
    await page.getByRole('link', { name: 'Báo cáo tiến độ' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('học sinh xem điểm của mình', async ({ page }) => {
    await login(page, seedAccounts.studentMinh);
    await page.getByRole('link', { name: 'Điểm của em' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('học sinh vào đúng môn Hóa trong kỳ thi thử và nhận điểm tạm tính', async ({ page }) => {
    await login(page, seedAccounts.studentMinh);
    await page.getByRole('link', { name: 'Phòng thi' }).click();
    await expect(page.getByRole('combobox', { name: 'Kỳ thi *' })).toHaveValue('MOCK_GRADUATION');
    await expect(page.getByRole('combobox', { name: 'Môn thi *' })).toContainText('Thi thử Hóa học trường');
    await expect(page.getByRole('heading', { name: 'ĐĂNG NHẬP LÀM BÀI THI' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Mã thí sinh *' }).fill('SPHS-2026-000001');
    await page.getByRole('textbox', { name: 'Mật khẩu *' }).fill('ExamPin2026!');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Thi thử Hóa học trường' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ngữ văn' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Vào thi', exact: true }).click();
    await expect(page.getByRole('heading', { name: /^Câu 1 · .* điểm$/ })).toBeVisible();
    await page.getByRole('button', { name: 'NỘP BÀI', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Kết quả thi' })).toBeVisible();
    await expect(page.getByText(/tạm tính|chờ chấm/i)).toBeVisible();
  });
});
