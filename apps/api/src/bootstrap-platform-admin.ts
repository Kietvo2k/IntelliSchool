import { createPool } from './db.js';
import { SmtpMailer } from './services/mailer.js';
import { bootstrapPlatformAdmin } from './services/platform-admin-bootstrap.js';

const databaseUrl = process.env.PLATFORM_CONTROL_DATABASE_URL;
const email = process.env.PLATFORM_ADMIN_EMAIL;
const displayName = process.env.PLATFORM_ADMIN_DISPLAY_NAME;
const smtpHost = process.env.SMTP_HOST;
if (!databaseUrl || !email || !displayName || !smtpHost) {
  throw new Error('PLATFORM_CONTROL_DATABASE_URL, PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_DISPLAY_NAME và SMTP_HOST là bắt buộc để bootstrap admin nền tảng.');
}

const pool = createPool(databaseUrl);
const mailer = new SmtpMailer({
  host: smtpHost,
  port: Number(process.env.SMTP_PORT ?? 1025),
  from: process.env.SMTP_FROM ?? 'no-reply@smartpath.local',
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://127.0.0.1:5176',
});

try {
  const result = await bootstrapPlatformAdmin(pool, mailer, { email, displayName });
  console.log(`Platform admin bootstrap: ${result.status} (${result.email}); activation email queued: ${result.activationEmailQueued}.`);
} finally {
  await pool.end();
}
