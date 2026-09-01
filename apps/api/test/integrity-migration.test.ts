import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('integrity incident migration contract', () => {
  it('creates server-owned incident state and keeps event history append-only', async () => {
    const sql = await readFile(new URL('../../../database/migrations/023_exam_integrity_incidents.sql', import.meta.url), 'utf8');

    expect(sql).toMatch(/CREATE TABLE(?: IF NOT EXISTS)? exam_integrity_incidents/);
    expect(sql).toContain('grace_ends_at timestamptz NOT NULL');
    expect(sql).toContain('lock_at timestamptz NOT NULL');
    expect(sql).toContain('closed_at timestamptz');
    expect(sql).toContain("CHECK (state IN ('GRACE', 'WARNING', 'LOCKED'))");
    expect(sql).toMatch(/ALTER TABLE exam_integrity_events\s+ADD COLUMN IF NOT EXISTS signal_id/);
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(sql).not.toMatch(/DROP TABLE\s+exam_integrity_incidents/i);
  });
});

