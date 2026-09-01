import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresPlatformRepository } from '../src/repositories/postgres-platform.js';
import { resetAndSeedPilotData, pilotAccounts } from '../src/seed-pilot.js';
import type { AuthContext } from '../src/types.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const apiUrl = process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const apiPool = new pg.Pool({ connectionString: apiUrl });

describe('billing management', () => {
  let admin: AuthContext;
  let owner: AuthContext;
  let schoolId: string;
  beforeAll(async () => {
    await resetAndSeedPilotData(controlPool);
    const adminRow = await controlPool.query<{ id: string; email: string; display_name: string }>("SELECT id, email::text, display_name FROM users WHERE email = 'admin@smartpath.test'");
    admin = { userId: adminRow.rows[0]!.id, email: adminRow.rows[0]!.email, displayName: adminRow.rows[0]!.display_name, role: 'PLATFORM_ADMIN' };
    const ownerRow = await controlPool.query<{ id: string; email: string; display_name: string; school_id: string }>(
      'SELECT u.id, u.email::text, u.display_name, m.school_id FROM users u JOIN school_memberships m ON m.user_id = u.id WHERE u.email = $1',
      [pilotAccounts.schoolOneOwner.email],
    );
    owner = { userId: ownerRow.rows[0]!.id, email: ownerRow.rows[0]!.email, displayName: ownerRow.rows[0]!.display_name, role: 'SCHOOL_OWNER', schoolId: ownerRow.rows[0]!.school_id };
    schoolId = ownerRow.rows[0]!.school_id;
  });
  afterAll(async () => { await Promise.all([controlPool.end(), apiPool.end()]); });

  it('lets an admin activate a subscription, record an event, and the owner sees the charge', async () => {
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    await repository.adminUpdateSubscription(admin, schoolId, { status: 'ACTIVE', includedClassQuota: 1, basePriceVnd: 1000000000, extraClassPriceVnd: 50000000 }, 'sub-int-1');
    await repository.adminRecordBillingEvent(admin, schoolId, { kind: 'INVOICE', amountVnd: 1050000000, note: 'Hóa đơn tháng 1' }, 'evt-int-1');

    const overview = await repository.getSchoolBillingOverview(owner) as { status: string; monthlyChargeVnd: number; isChargeable: boolean; events: Array<{ kind: string }> };
    expect(overview.status).toBe('ACTIVE');
    expect(overview.isChargeable).toBe(true);
    expect(overview.monthlyChargeVnd).toBeGreaterThan(0);
    expect(overview.events.some((event) => event.kind === 'INVOICE')).toBe(true);
  });

  it('blocks a school owner from admin subscription listing', async () => {
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    await expect(repository.adminListSubscriptions(owner)).rejects.toMatchObject({ statusCode: 403 });
  });
});
