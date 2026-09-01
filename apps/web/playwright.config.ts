import { defineConfig, devices } from '@playwright/test';

/**
 * Cấu hình Playwright cho bộ kiểm thử end-to-end Phase 3F.
 *
 * Bộ test này yêu cầu toàn bộ stack đang chạy thật:
 *   docker compose up -d postgres minio mailpit clamav
 *   npm run db:seed
 *   npm run dev          (api :3002, web :5176)
 *   npx playwright test  (chạy trong apps/web)
 *
 * Không đưa bộ e2e trình duyệt vào `npm run verify` để verify vẫn chạy được khi
 * chưa dựng stack. Xem apps/web/e2e/README.md.
 */
const webBaseUrl = process.env.SMARTPATH_E2E_WEB_URL ?? 'http://127.0.0.1:5176';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: webBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'vi-VN',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
