import { describe, expect, it, vi } from 'vitest';
import { processNextResourceScan, type ClaimedResourceScanJob } from '../src/services/resource-scan-worker.js';

const job: ClaimedResourceScanJob = {
  id: 'job-1', schoolId: 'school-1', resourceId: 'resource-1',
  quarantineObjectKey: 'quarantine/resource-1', readyObjectKey: 'resources/resource-1', attempts: 0,
};

function dependencies(result: 'CLEAN' | 'INFECTED' | Error) {
  const repository = {
    claimNext: vi.fn(async () => job),
    markReady: vi.fn(async () => undefined),
    rejectInfected: vi.fn(async () => undefined),
    retryAfterFailure: vi.fn(async () => undefined),
  };
  const storage = { promote: vi.fn(async () => undefined), deleteQuarantine: vi.fn(async () => undefined) };
  const scanner = { scan: vi.fn(async () => { if (result instanceof Error) throw result; return result; }) };
  return { repository, storage, scanner };
}

describe('processNextResourceScan', () => {
  it('promotes a clean resource before marking it READY', async () => {
    const deps = dependencies('CLEAN');

    await expect(processNextResourceScan(deps)).resolves.toEqual({ outcome: 'READY', resourceId: job.resourceId });

    expect(deps.storage.promote).toHaveBeenCalledWith(job.quarantineObjectKey, job.readyObjectKey);
    expect(deps.repository.markReady).toHaveBeenCalledWith(job);
    expect(deps.storage.deleteQuarantine).toHaveBeenCalledWith(job.quarantineObjectKey);
  });

  it('deletes an infected resource and never promotes it', async () => {
    const deps = dependencies('INFECTED');

    await expect(processNextResourceScan(deps)).resolves.toEqual({ outcome: 'REJECTED', resourceId: job.resourceId });

    expect(deps.storage.deleteQuarantine).toHaveBeenCalledWith(job.quarantineObjectKey);
    expect(deps.repository.rejectInfected).toHaveBeenCalledWith(job);
    expect(deps.storage.promote).not.toHaveBeenCalled();
  });

  it('keeps a resource quarantined and stops retrying after the third scanner failure', async () => {
    const deps = dependencies(new Error('clamd unavailable'));

    await expect(processNextResourceScan(deps)).resolves.toEqual({ outcome: 'RETRY', resourceId: job.resourceId, attempts: 1 });
    expect(deps.repository.retryAfterFailure).toHaveBeenCalledWith(job, 'clamd unavailable', 1);
    expect(deps.storage.deleteQuarantine).not.toHaveBeenCalled();
  });

  it('removes control bytes from a scanner error before it reaches durable storage', async () => {
    const deps = dependencies(new Error('clamd\u0000 unavailable'));

    await processNextResourceScan(deps);

    expect(deps.repository.retryAfterFailure).toHaveBeenCalledWith(job, 'clamd unavailable', 1);
  });
});
