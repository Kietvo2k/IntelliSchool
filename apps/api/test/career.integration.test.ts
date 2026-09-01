import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresPlatformRepository } from '../src/repositories/postgres-platform.js';
import { resetAndSeedPilotData } from '../src/seed-pilot.js';
import type { AuthContext } from '../src/types.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const apiUrl = process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const apiPool = new pg.Pool({ connectionString: apiUrl });

describe('career catalog', () => {
  let admin: AuthContext;
  beforeAll(async () => {
    await resetAndSeedPilotData(controlPool);
    const row = await controlPool.query<{ id: string; email: string; display_name: string }>("SELECT id, email::text, display_name FROM users WHERE email = 'admin@smartpath.test'");
    admin = { userId: row.rows[0]!.id, email: row.rows[0]!.email, displayName: row.rows[0]!.display_name, role: 'PLATFORM_ADMIN' };
  });
  afterAll(async () => { await Promise.all([controlPool.end(), apiPool.end()]); });

  it('imports admission scores by exam block and surfaces them with sources', async () => {
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    await repository.adminUpsertInstitution(admin, { code: 'HUST', name: 'Đại học Bách khoa Hà Nội', province: 'Hà Nội' }, 'inst-0001');
    await repository.adminUpsertMajor(admin, { code: 'AI', name: 'Trí tuệ nhân tạo' }, 'major-0001');

    await expect(repository.adminImportAdmissionScores(admin, { rows: [{ institutionCode: 'HUST', majorCode: 'AI', year: 2026, examBlock: 'BAD', score: 27 }] }, 'import-bad'))
      .rejects.toMatchObject({ code: 'ADMISSION_IMPORT_INVALID' });

    const imported = await repository.adminImportAdmissionScores(admin, { rows: [
      { institutionCode: 'HUST', majorCode: 'AI', year: 2026, examBlock: 'A00', score: 28.5, sourceUrl: 'https://hust.edu.vn/diemchuan' },
      { institutionCode: 'HUST', majorCode: 'AI', year: 2026, examBlock: 'A01', score: 28.0, sourceUrl: 'https://hust.edu.vn/diemchuan' },
    ] }, 'import-ok') as { imported: number };
    expect(imported.imported).toBe(2);

    const institutions = await repository.listInstitutions(admin, { query: 'Bách khoa Hà Nội' }) as Array<{ id: string; name: string }>;
    const hust = institutions.find((row) => row.name.includes('Hà Nội'));
    expect(hust).toBeTruthy();
    const detail = await repository.getInstitutionDetail(admin, hust!.id) as { programs: Array<{ admissionScores: Array<{ examBlock: string | null; sourceUrl: string | null }> }> };
    const blocks = detail.programs.flatMap((program) => program.admissionScores.map((score) => score.examBlock));
    expect(blocks).toContain('A00');
    expect(blocks).toContain('A01');
    expect(detail.programs.flatMap((program) => program.admissionScores).every((score) => score.sourceUrl)).toBe(true);
  });

  it('refuses catalog writes from a non-admin', async () => {
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const teacher: AuthContext = { userId: admin.userId, email: 't@e.test', displayName: 'T', role: 'TEACHER', schoolId: '00000000-0000-4000-8000-000000000000' };
    await expect(repository.adminUpsertCareer(teacher, { code: 'X', name: 'Y' }, 'career-forbidden')).rejects.toMatchObject({ statusCode: 403 });
  });
});
