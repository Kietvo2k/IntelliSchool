import { expect, test } from '@playwright/test';
import { seedAccounts, login } from './fixtures.js';

const roleAccounts = [
  seedAccounts.platformAdmin,
  seedAccounts.ownerNguyenDu,
  seedAccounts.teacherToan,
  seedAccounts.studentMinh,
] as const;

test.describe('Route matrix theo vai trò', () => {
  for (const account of roleAccounts) {
    test(`mọi route điều hướng của ${account} render được`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });

      await login(page, account);
      await page.goto('/app');
      await page.locator('.workspace-shell').waitFor();
      await page.waitForTimeout(250);
      const hrefs = await page.locator('a').evaluateAll((links) => (
        [...new Set(links.map((link) => (link as HTMLAnchorElement).getAttribute('href'))
          .filter((href): href is string => Boolean(href) && href.startsWith('/app')))]
      ));

      expect(hrefs.length, `${account}: expected at least one workspace route`).toBeGreaterThan(0);
      for (const href of hrefs) {
        const errorsBeforeRoute = errors.length;
        await page.goto(href);
        await expect(page.locator('.workspace-main, .cbt-app').first(), `${account}: ${href}`).toBeVisible();
        expect(errors.slice(errorsBeforeRoute), `${account}: ${href}`).toEqual([]);
      }
      expect(errors, `${account}: ${errors.join('\n')}`).toEqual([]);
    });
  }
});
