import { createPool } from './db.js';
import { PostgresPlatformRepository } from './repositories/postgres-platform.js';
import { loadExamSnapshotKeyring } from './security/exam-snapshot.js';

const apiDatabaseUrl = process.env.API_DATABASE_URL;
const controlDatabaseUrl = process.env.PLATFORM_CONTROL_DATABASE_URL;
if (!apiDatabaseUrl || !controlDatabaseUrl) throw new Error('API_DATABASE_URL and PLATFORM_CONTROL_DATABASE_URL are required.');

const keyring = await loadExamSnapshotKeyring({
  filePath: process.env.EXAM_SNAPSHOT_KEYRING_FILE ?? '',
  activeKeyVersion: process.env.EXAM_SNAPSHOT_ACTIVE_KEY_VERSION ?? '',
});
const apiPool = createPool(apiDatabaseUrl);
const controlPool = createPool(controlDatabaseUrl);
const repository = new PostgresPlatformRepository({ apiPool, controlPool, examSnapshotKeyring: keyring });

try {
  if (process.argv.includes('--rotate')) {
    const assignments = await controlPool.query<{ id: string; school_id: string; owner_id: string; email: string; display_name: string }>(`
      SELECT a.id, a.school_id, s.owner_id, u.email::text, u.display_name
      FROM assignments a
      JOIN schools s ON s.id = a.school_id
      JOIN users u ON u.id = s.owner_id
      JOIN exam_snapshots es ON es.id = a.active_exam_snapshot_id
      WHERE a.delivery_mode = 'EXAM' AND es.key_version <> $1
      ORDER BY a.id
    `, [keyring.activeKeyVersion]);
    let rotated = 0;
    for (const assignment of assignments.rows) {
      const result = await repository.rotateExamSnapshot({ userId: assignment.owner_id, schoolId: assignment.school_id, email: assignment.email, displayName: assignment.display_name, role: 'SCHOOL_OWNER', homeroomClassIds: [] }, assignment.id) as { rotated: boolean };
      if (result.rotated) rotated += 1;
    }
    console.log(`Exam snapshot rotation completed: ${rotated}`);
  } else {
    console.log(`Exam snapshot backfill completed: ${await repository.backfillExamSnapshots()}`);
  }
} finally {
  await Promise.all([apiPool.end(), controlPool.end()]);
}
