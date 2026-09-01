import { buildApp } from './app.js';
import { createPool } from './db.js';
import { PostgresAuthRepository } from './repositories/postgres-auth.js';
import { PostgresPlatformRepository } from './repositories/postgres-platform.js';
import { PostgresSchoolAdministrationRepository } from './repositories/postgres-school-administration.js';
import { PostgresResourceRepository } from './repositories/postgres-resources.js';
import { FileMailer, SmtpMailer } from './services/mailer.js';
import { ResourceUploadService } from './services/resource-upload-service.js';
import { ResourceDownloadService } from './services/resource-download-service.js';
import { ReportExportDownloadService } from './services/report-export-download-service.js';
import { createResourceStorage } from './services/storage-factory.js';
import { startInlineWorkers } from './services/inline-workers.js';
import { LocalResourceStorage } from './services/local-resource-storage.js';
import fastifyStatic from '@fastify/static';

const port = Number(process.env.PORT ?? 3002);
const host = process.env.HOST ?? '127.0.0.1';
const publicDatabaseUrl = process.env.PUBLIC_DATABASE_URL;
const apiDatabaseUrl = process.env.API_DATABASE_URL;
const controlDatabaseUrl = process.env.PLATFORM_CONTROL_DATABASE_URL;
if (!publicDatabaseUrl || !apiDatabaseUrl || !controlDatabaseUrl) {
  throw new Error('PUBLIC_DATABASE_URL, API_DATABASE_URL and PLATFORM_CONTROL_DATABASE_URL are required.');
}

const appBaseUrl = process.env.APP_BASE_URL ?? 'http://127.0.0.1:5176';
const mailFrom = process.env.SMTP_FROM ?? 'no-reply@smartpath.local';
const mailer = process.env.SMTP_HOST
  ? new SmtpMailer({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 1025), from: mailFrom, appBaseUrl })
  : new FileMailer({ directory: process.env.MAIL_DIR ?? 'data/mail', from: mailFrom, appBaseUrl });
const authRepository = new PostgresAuthRepository(createPool(controlDatabaseUrl), mailer);
const schoolAdministrationRepository = new PostgresSchoolAdministrationRepository({
  publicPool: createPool(publicDatabaseUrl), controlPool: createPool(controlDatabaseUrl), mailer,
});
const platformRepository = new PostgresPlatformRepository({
  apiPool: createPool(apiDatabaseUrl),
  controlPool: createPool(controlDatabaseUrl),
  mailer,
  crawlAllowlist: new Set((process.env.PLATFORM_CRAWL_ALLOWLIST ?? '').split(',').map((hostName) => hostName.trim().toLowerCase()).filter(Boolean)),
});
void platformRepository.recoverPendingAiJobs().catch(() => undefined);
const aiRecoveryTimer = setInterval(() => { void platformRepository.recoverPendingAiJobs().catch((error) => console.error(error)); }, 15_000);
aiRecoveryTimer.unref();
const examFinalizerTimer = setInterval(() => { void platformRepository.finalizeExpiredExamSessions().catch((error) => console.error(error)); }, 5_000);
examFinalizerTimer.unref();
const resourceRepository = new PostgresResourceRepository(createPool(apiDatabaseUrl));
const resourceStorage = createResourceStorage();
const resourceUploadService = resourceStorage ? new ResourceUploadService({ storage: resourceStorage, repository: resourceRepository }) : undefined;
const resourceDownloadService = resourceStorage ? new ResourceDownloadService({ storage: resourceStorage, repository: resourceRepository }) : undefined;
const reportExportDownloadService = resourceStorage ? new ReportExportDownloadService({ storage: resourceStorage, repository: platformRepository }) : undefined;
const openSignedFile = resourceStorage instanceof LocalResourceStorage
  ? (token: string) => resourceStorage.openSigned(token)
  : undefined;
const workerPool = resourceStorage ? createPool(controlDatabaseUrl) : undefined;
const app = buildApp({ authRepository, schoolAdministrationRepository, platformRepository, resourceRepository, resourceUploadService, resourceDownloadService, reportExportDownloadService, openSignedFile });
app.addHook('onClose', async () => { clearInterval(aiRecoveryTimer); clearInterval(examFinalizerTimer); });
if (resourceStorage && workerPool) startInlineWorkers({ app, controlPool: workerPool, storage: resourceStorage });
const webDist = process.env.WEB_DIST_DIR?.trim();
if (webDist) {
  await app.register(fastifyStatic, { root: webDist, prefix: '/', wildcard: true });
  app.setNotFoundHandler((request, reply) => {
    if (request.method !== 'GET' || request.url.startsWith('/api') || request.url.startsWith('/healthz')) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy.', request_id: request.id } });
    }
    return reply.sendFile('index.html');
  });
}
app.addHook('onClose', async () => {
  await Promise.all([
    authRepository.close(),
    schoolAdministrationRepository.close(),
    platformRepository.close(),
    resourceRepository.close(),
    workerPool?.end() ?? Promise.resolve(),
  ]);
});
await app.listen({ port, host });
console.log(`Smart Path listening on http://${host}:${port}`);
