import { buildApp } from './app.js';
import { createPool } from './db.js';
import { PostgresAuthRepository } from './repositories/postgres-auth.js';
import { PostgresPlatformRepository } from './repositories/postgres-platform.js';
import { PostgresSchoolAdministrationRepository } from './repositories/postgres-school-administration.js';

const port = Number(process.env.PORT ?? 3002);
const host = process.env.HOST ?? '127.0.0.1';
const publicDatabaseUrl = process.env.PUBLIC_DATABASE_URL;
const apiDatabaseUrl = process.env.API_DATABASE_URL;
const controlDatabaseUrl = process.env.PLATFORM_CONTROL_DATABASE_URL;
if (!publicDatabaseUrl || !apiDatabaseUrl || !controlDatabaseUrl) {
  throw new Error('PUBLIC_DATABASE_URL, API_DATABASE_URL and PLATFORM_CONTROL_DATABASE_URL are required.');
}

const authRepository = new PostgresAuthRepository(createPool(controlDatabaseUrl));
const schoolAdministrationRepository = new PostgresSchoolAdministrationRepository({
  publicPool: createPool(publicDatabaseUrl), controlPool: createPool(controlDatabaseUrl),
});
const platformRepository = new PostgresPlatformRepository({
  apiPool: createPool(apiDatabaseUrl),
  controlPool: createPool(controlDatabaseUrl),
  crawlAllowlist: new Set((process.env.PLATFORM_CRAWL_ALLOWLIST ?? '').split(',').map((hostName) => hostName.trim().toLowerCase()).filter(Boolean)),
});
const app = buildApp({ authRepository, schoolAdministrationRepository, platformRepository });
app.addHook('onClose', async () => {
  await Promise.all([authRepository.close(), schoolAdministrationRepository.close(), platformRepository.close()]);
});
await app.listen({ port, host });
