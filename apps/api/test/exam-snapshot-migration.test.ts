import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('exam snapshot migration contract', () => {
  it('defines an append-only encrypted snapshot boundary with tenant protection', async () => {
    const sql = await readFile(new URL('../../../database/migrations/022_exam_snapshots.sql', import.meta.url), 'utf8');

    expect(sql).toMatch(/CREATE TABLE(?: IF NOT EXISTS)? exam_snapshots/);
    expect(sql).toContain('ciphertext bytea NOT NULL');
    expect(sql).toContain('nonce bytea NOT NULL');
    expect(sql).toContain('auth_tag bytea NOT NULL');
    expect(sql).toContain('key_version text NOT NULL');
    expect(sql).toContain('metadata_hash char(64) NOT NULL');
    expect(sql).toMatch(/ALTER TABLE assignments\s+ADD COLUMN IF NOT EXISTS active_exam_snapshot_id/);
    expect(sql).toMatch(/ALTER TABLE exam_sessions\s+ADD COLUMN IF NOT EXISTS exam_snapshot_id/);
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(sql).toMatch(/WITH CHECK \(school_id = app_current_school_id\(\)\)/);
    expect(sql).not.toMatch(/DROP TABLE\s+exam_snapshots/i);
    expect(sql).not.toMatch(/DROP COLUMN\s+(ciphertext|nonce|auth_tag)/i);
  });
});
