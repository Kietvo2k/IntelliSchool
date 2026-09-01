import { expect, type Page } from '@playwright/test';

/**
 * Tài khoản seed dùng cho e2e. Tất cả là test-only, mật khẩu dùng chung theo
 * seed-pilot; phải đổi trước khi dùng thật (xem README gốc).
 */
export const SEED_PASSWORD = process.env.SMARTPATH_E2E_PASSWORD ?? 'TestOnlyPassword!2026';

export const seedAccounts = {
  platformAdmin: 'admin@smartpath.test',
  ownerNguyenDu: 'hieutruong.nguyendu@smartpath.test',
  ownerLeQuyDon: 'hieutruong.lequydon@smartpath.test',
  teacherToan: 'giaovien.toan@nguyendu.smartpath.test',
  teacherHomeroom: 'giaovien.chunhiem@nguyendu.smartpath.test',
  studentMinh: 'hocsinh.minh@nguyendu.smartpath.test',
} as const;

/** Đăng nhập qua trang /auth/login (cookie session, không JWT, không dialog landing). */
export async function login(page: Page, email: string, password: string = SEED_PASSWORD): Promise<void> {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.locator('.workspace-shell')).toBeVisible({ timeout: 15_000 });
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
}

/** Điều hướng bằng menu bên trái theo nhãn tiếng Việt. */
export async function gotoWorkspace(page: Page, label: string): Promise<void> {
  await page.getByRole('link', { name: label }).click();
}
