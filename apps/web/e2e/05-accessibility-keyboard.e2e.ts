import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { seedAccounts, login } from './fixtures.js';

const breakpoints = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

async function assertNoSeriousViolations(page: import('@playwright/test').Page, context: string) {
  await page.waitForTimeout(400);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(blocking, `${context}: ${blocking.map((v) => v.id).join(', ')}`).toEqual([]);
}

test.describe('Accessibility ở 4 breakpoint', () => {
  test('trang chủ công khai không có lỗi axe critical/serious', async ({ page }) => {
    for (const bp of breakpoints) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/');
      await assertNoSeriousViolations(page, `home @ ${bp.name}`);
    }
  });

  for (const account of [seedAccounts.platformAdmin, seedAccounts.teacherToan, seedAccounts.studentMinh]) {
    test(`workspace của ${account} không có lỗi axe critical/serious`, async ({ page }) => {
      await login(page, account);
      for (const bp of breakpoints) {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await page.goto('/app');
        await expect(page.locator('.workspace-shell')).toBeVisible();
        await assertNoSeriousViolations(page, `dashboard ${account} @ ${bp.name}`);
      }
    });
  }
});

test.describe('Điều hướng bằng bàn phím', () => {
  test('học sinh mở và đóng drawer điều hướng trên mobile', async ({ page }) => {
    await login(page, seedAccounts.studentMinh);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app');

    const open = page.getByRole('button', { name: 'Mở điều hướng' });
    await open.click();
    await expect(open).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('complementary', { name: 'Điều hướng workspace' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(open).toHaveAttribute('aria-expanded', 'false');
    await expect(open).toBeFocused();
  });

  test('học sinh mở được trang bài tập chỉ bằng bàn phím', async ({ page }) => {
    await login(page, seedAccounts.studentMinh);
    await page.goto('/app');
    // Tab tới link "Bài tập" và Enter
    const assignments = page.getByRole('link', { name: 'Bài tập' });
    await assignments.focus();
    await expect(assignments).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Bài tập theo lớp' })).toBeVisible();
  });

  test('giáo viên mở được trang chấm tự luận chỉ bằng bàn phím', async ({ page }) => {
    await login(page, seedAccounts.teacherToan);
    await page.goto('/app');
    const grading = page.getByRole('link', { name: 'Chấm tự luận' });
    await grading.focus();
    await expect(grading).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Tự luận chờ chấm' })).toBeVisible();
  });
});

test.describe('Dashboard 4 vai trò có dữ liệu', () => {
  const roleAccounts = [
    seedAccounts.platformAdmin,
    seedAccounts.ownerNguyenDu,
    seedAccounts.teacherToan,
    seedAccounts.studentMinh,
  ];
  for (const account of roleAccounts) {
    test(`dashboard ${account} render không lỗi console`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
      await login(page, account);
      await page.goto('/app');
      await expect(page.locator('.workspace-main')).toBeVisible();
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
});
