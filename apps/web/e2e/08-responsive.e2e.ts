import { expect, test } from '@playwright/test';
import { seedAccounts, login } from './fixtures.js';

test('các màn hình chính không tràn ngang ở các breakpoint hỗ trợ', async ({ page }) => {
  await login(page, seedAccounts.studentMinh);
  for (const width of [320, 375, 414, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/app/exam', '/app/ai-study', '/app/career-quiz', '/app/career-results', '/app/career-schools']) {
      await page.goto(route);
      await expect(page.locator('body')).toBeVisible();
      const metrics = await page.evaluate(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      expect(metrics.scrollWidth, `${route} tràn ngang ở ${width}px`).toBeLessThanOrEqual(metrics.innerWidth + 1);
    }
  }
});
