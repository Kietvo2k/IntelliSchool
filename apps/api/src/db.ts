import pg from 'pg';

export interface TenantTransactionContext {
  schoolId?: string;
  userId?: string;
}

export function createPool(connectionString: string) {
  const max = Math.max(1, Number(process.env.PG_POOL_MAX ?? 10) || 10);
  return new pg.Pool({ connectionString, max });
}

/** Sets tenant and actor context transaction-locally so a pooled connection cannot leak scope. */
export async function withTenantTransaction<T>(
  pool: pg.Pool,
  context: TenantTransactionContext,
  operation: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.school_id', $1, true), set_config('app.user_id', $2, true)", [context.schoolId ?? '', context.userId ?? '']);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
