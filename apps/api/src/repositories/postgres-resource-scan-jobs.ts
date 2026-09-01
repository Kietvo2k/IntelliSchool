import type pg from 'pg';
import type { ClaimedResourceScanJob } from '../services/resource-scan-worker.js';

export class PostgresResourceScanJobRepository {
  constructor(private readonly controlPool: pg.Pool) {}

  async claimNext(): Promise<ClaimedResourceScanJob | undefined> {
    const client = await this.controlPool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{ id: string; school_id: string; resource_id: string; object_key: string; attempts: number }>(`
        SELECT j.id, j.school_id, j.resource_id, r.object_key, j.attempts
        FROM resource_scan_jobs j JOIN resources r ON r.id = j.resource_id
        WHERE j.status IN ('QUEUED', 'FAILED') AND j.attempts < 3 AND r.status = 'QUARANTINED'
        ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1
      `);
      const row = result.rows[0];
      if (!row) { await client.query('COMMIT'); return undefined; }
      await client.query(`UPDATE resource_scan_jobs SET status = 'PROCESSING', locked_at = now(), updated_at = now() WHERE id = $1`, [row.id]);
      await client.query(`UPDATE resources SET status = 'PROCESSING' WHERE id = $1`, [row.resource_id]);
      await client.query('COMMIT');
      return { id: row.id, schoolId: row.school_id, resourceId: row.resource_id, quarantineObjectKey: row.object_key, readyObjectKey: `resources/${row.resource_id}`, attempts: row.attempts };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async markReady(job: ClaimedResourceScanJob): Promise<void> {
    await this.finish(job, async (client) => {
      await client.query(`UPDATE resources SET status = 'READY', object_key = $2 WHERE id = $1`, [job.resourceId, job.readyObjectKey]);
      await client.query(`UPDATE resource_scan_jobs SET status = 'READY', completed_at = now(), updated_at = now(), locked_at = NULL WHERE id = $1`, [job.id]);
      await this.audit(client, job, 'RESOURCE_SCAN_READY', {});
    });
  }

  async rejectInfected(job: ClaimedResourceScanJob): Promise<void> {
    await this.finish(job, async (client) => {
      await client.query(`UPDATE resources SET status = 'REJECTED' WHERE id = $1`, [job.resourceId]);
      await client.query(`UPDATE resource_scan_jobs SET status = 'REJECTED', completed_at = now(), updated_at = now(), locked_at = NULL, last_error = 'Tệp bị ClamAV từ chối.' WHERE id = $1`, [job.id]);
      await this.audit(client, job, 'RESOURCE_SCAN_REJECTED', { reason: 'INFECTED' });
    });
  }

  async retryAfterFailure(job: ClaimedResourceScanJob, message: string, attempts: number): Promise<void> {
    await this.finish(job, async (client) => {
      const terminal = attempts >= 3;
      await client.query(`UPDATE resources SET status = 'QUARANTINED' WHERE id = $1`, [job.resourceId]);
      await client.query(`UPDATE resource_scan_jobs SET status = $2::job_status, attempts = $3, last_error = $4, locked_at = NULL, completed_at = CASE WHEN $5 THEN now() ELSE NULL END, updated_at = now() WHERE id = $1`, [job.id, terminal ? 'FAILED' : 'QUEUED', attempts, message.slice(0, 2_000), terminal]);
      if (terminal) await this.audit(client, job, 'RESOURCE_SCAN_FAILED', { attempts, message: message.slice(0, 500) });
    });
  }

  private async finish(job: ClaimedResourceScanJob, work: (client: pg.PoolClient) => Promise<void>): Promise<void> {
    const client = await this.controlPool.connect();
    try { await client.query('BEGIN'); await work(client); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  private async audit(client: pg.PoolClient, job: ClaimedResourceScanJob, action: string, metadata: Record<string, unknown>): Promise<void> {
    await client.query(`INSERT INTO audit_events (school_id, action, target_type, target_id, metadata) VALUES ($1, $2, 'resource', $3, $4::jsonb)`, [job.schoolId, action, job.resourceId, JSON.stringify(metadata)]);
  }
}
