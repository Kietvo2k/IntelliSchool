export interface ClaimedResourceScanJob {
  id: string;
  schoolId: string;
  resourceId: string;
  quarantineObjectKey: string;
  readyObjectKey: string;
  attempts: number;
}

export interface ResourceScanWorkerDependencies {
  repository: {
    claimNext(): Promise<ClaimedResourceScanJob | undefined>;
    markReady(job: ClaimedResourceScanJob): Promise<void>;
    rejectInfected(job: ClaimedResourceScanJob): Promise<void>;
    retryAfterFailure(job: ClaimedResourceScanJob, message: string, attempts: number): Promise<void>;
  };
  storage: {
    promote(quarantineObjectKey: string, readyObjectKey: string): Promise<void>;
    deleteQuarantine(quarantineObjectKey: string): Promise<void>;
  };
  scanner: { scan(quarantineObjectKey: string): Promise<'CLEAN' | 'INFECTED'>; };
}

export type ResourceScanOutcome =
  | { outcome: 'IDLE' }
  | { outcome: 'READY' | 'REJECTED'; resourceId: string }
  | { outcome: 'RETRY'; resourceId: string; attempts: number };

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Không thể quét tệp tại thời điểm này.';
  // eslint-disable-next-line no-control-regex -- Error text is normalized before it reaches a job record.
  return message.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2_000) || 'Không thể quét tệp tại thời điểm này.';
}

export async function processNextResourceScan(dependencies: ResourceScanWorkerDependencies): Promise<ResourceScanOutcome> {
  const job = await dependencies.repository.claimNext();
  if (!job) return { outcome: 'IDLE' };
  try {
    const result = await dependencies.scanner.scan(job.quarantineObjectKey);
    if (result === 'INFECTED') {
      await dependencies.storage.deleteQuarantine(job.quarantineObjectKey);
      await dependencies.repository.rejectInfected(job);
      return { outcome: 'REJECTED', resourceId: job.resourceId };
    }
    await dependencies.storage.promote(job.quarantineObjectKey, job.readyObjectKey);
    await dependencies.repository.markReady(job);
    await dependencies.storage.deleteQuarantine(job.quarantineObjectKey).catch(() => undefined);
    return { outcome: 'READY', resourceId: job.resourceId };
  } catch (error) {
    const attempts = Math.min(3, job.attempts + 1);
    await dependencies.repository.retryAfterFailure(job, safeErrorMessage(error), attempts);
    return { outcome: 'RETRY', resourceId: job.resourceId, attempts };
  }
}
