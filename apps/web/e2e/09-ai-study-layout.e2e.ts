import { expect, test } from '@playwright/test';
import { login, seedAccounts } from './fixtures.js';

test('AI học tập keeps automatic controls compact and fits a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await login(page, seedAccounts.studentMinh);
  await page.goto('/app/ai-study');

  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto('/app/ai-study');
  const desktopColumns = await page.locator('.ai-study-page .chat-shell').evaluate((node) => {
    const sessions = node.querySelector<HTMLElement>('.chat-shell-sessions')?.getBoundingClientRect();
    const main = node.querySelector<HTMLElement>('.chat-shell-main')?.getBoundingClientRect();
    return { sessionsWidth: sessions?.width ?? 0, mainWidth: main?.width ?? 0 };
  });
  expect(desktopColumns.sessionsWidth).toBeLessThan(desktopColumns.mainWidth);

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/app/ai-study');

  await expect(page.getByRole('heading', { name: 'AI học tập' })).toBeVisible();
  await expect(page.getByText('Tài liệu: tự động · Điều chỉnh phạm vi')).toBeVisible();
  await expect(page.locator('.chat-mode-toolbar')).toHaveCount(0);
  await expect(page.locator('.ai-study-page .chat-shell')).toBeVisible();

  const layout = await page.locator('html').evaluate((node) => ({ scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
});
