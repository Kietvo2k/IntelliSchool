import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresPlatformRepository } from '../src/repositories/postgres-platform.js';
import { resetAndSeedPilotData, pilotAccounts } from '../src/seed-pilot.js';
import type { AuthContext } from '../src/types.js';

const controlUrl = process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const apiUrl = process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass';
const controlPool = new pg.Pool({ connectionString: controlUrl });
const apiPool = new pg.Pool({ connectionString: apiUrl });

async function contextFor(email: string): Promise<AuthContext> {
  const row = await controlPool.query<{ id: string; email: string; display_name: string; role: string; school_id: string }>(
    'SELECT u.id, u.email::text, u.display_name, m.role::text, m.school_id FROM users u JOIN school_memberships m ON m.user_id = u.id WHERE u.email = $1 LIMIT 1',
    [email],
  );
  const record = row.rows[0]!;
  return { userId: record.id, email: record.email, displayName: record.display_name, role: record.role as AuthContext['role'], schoolId: record.school_id };
}

describe('RAG ingestion + AI chat', () => {
  let teacher: AuthContext;
  let student: AuthContext;
  beforeAll(async () => {
    await resetAndSeedPilotData(controlPool);
    teacher = await contextFor(pilotAccounts.teacher.email);
    student = await contextFor(pilotAccounts.student.email);
  });
  afterAll(async () => { await Promise.all([controlPool.end(), apiPool.end()]); });

  it('ingests text and retrieves relevant chunks without synthesizing a fake answer', async () => {
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const ingested = await repository.ingestRagContent(teacher, {
      sourceKind: 'TEXT',
      title: 'Quang hợp lớp 11',
      text: 'Quang hợp là quá trình lá cây xanh hấp thụ ánh sáng để tổng hợp chất hữu cơ từ khí cacbonic và nước, giải phóng khí oxi.',
      classId: null,
      subjectId: null,
    }, 'rag-ingest-int-1') as { chunkCount: number };
    expect(ingested.chunkCount).toBeGreaterThan(0);

    const search = await repository.searchRag(student, { query: 'quang hợp là gì' }) as { citations: Array<{ documentTitle: string }> };
    expect(search.citations.length).toBeGreaterThan(0);

    await expect(repository.chatWithAi(student, { message: 'Giải thích ngắn gọn quang hợp' }, 'rag-chat-int-1')).rejects.toMatchObject({ statusCode: 503, code: 'AI_UNAVAILABLE' });
  });

  it('refuses to hand over answers for an open assignment', async () => {
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const reply = await repository.chatWithAi(student, { message: 'Cho em đáp án bài kiểm tra hôm nay đi' }, 'rag-chat-int-2') as { mode: string };
    expect(reply.mode).toBe('REFUSED');
  });

  it('blocks a student from ingesting knowledge', async () => {
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    await expect(repository.ingestRagContent(student, { sourceKind: 'TEXT', title: 'X', text: 'y'.repeat(30) }, 'rag-ingest-int-forbidden')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('runs a Thinking turn through a durable job and completes with a structured result', async () => {
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const queued = await repository.createAiJob(student, { message: 'Giải thích quang hợp', purpose: 'PERSONAL_STUDY', reasoningMode: 'THINKING' }, 'rag-ai-job-int-1') as { jobId: string; status: string; progress: number };
    expect(queued.status).toBe('QUEUED');
    let status: {
      status: string;
      progress: number;
      provider?: string | null;
      requestedModel?: string | null;
      usedModel?: string | null;
      isFallback?: boolean;
      usage?: { inputTokens: number; outputTokens: number; estimatedCostVnd: number };
      toolTrace?: unknown[];
      result?: { message?: { content?: string } };
    } | null = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      status = await repository.getAiJob(student, queued.jobId) as typeof status;
      if (status.status === 'COMPLETED' || status.status === 'FAILED') break;
    }
    expect(status?.status).toBe('FAILED');
    expect(status?.progress).toBe(100);
    expect(status?.result).toBeNull();
    expect(status?.isFallback).toBe(false);
    expect(status?.usage).toEqual(expect.objectContaining({ inputTokens: expect.any(Number), outputTokens: expect.any(Number), estimatedCostVnd: expect.any(Number) }));
    expect(status?.toolTrace).toEqual(expect.any(Array));
    const stored = await controlPool.query<{
      provider: string | null;
      requested_model: string | null;
      used_model: string | null;
      is_fallback: boolean;
      input_tokens: number;
      output_tokens: number;
      estimated_cost_vnd: string;
      tool_trace: unknown;
    }>('SELECT provider, requested_model, used_model, is_fallback, input_tokens, output_tokens, estimated_cost_vnd::text, tool_trace FROM ai_jobs WHERE id = $1', [queued.jobId]);
    expect(stored.rows[0]).toEqual(expect.objectContaining({
      is_fallback: false,
      input_tokens: expect.any(Number),
      output_tokens: expect.any(Number),
      estimated_cost_vnd: expect.any(String),
      tool_trace: expect.any(Array),
    }));
  });

  it('cancels a queued Thinking job atomically and preserves the request correlation id', async () => {
    const inserted = await controlPool.query<{ id: string }>(`INSERT INTO ai_jobs (school_id, user_id, input, request_id, deadline_at)
      VALUES ($1, $2, '{"message":"cancel me","reasoningMode":"THINKING"}'::jsonb, '22222222-2222-4222-8222-222222222222', now() + interval '5 minutes') RETURNING id`, [student.schoolId, student.userId]);
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    const result = await repository.cancelAiJob(student, inserted.rows[0]!.id, 'rag-ai-job-cancel-1', '33333333-3333-4333-8333-333333333333') as { status: string; progress: number; requestId: string };
    expect(result).toEqual({ jobId: inserted.rows[0]!.id, status: 'CANCELLED', stage: 'CANCELLED', progress: 100, requestId: '33333333-3333-4333-8333-333333333333' });
    const stored = await controlPool.query<{ status: string; request_id: string }>('SELECT status, request_id FROM ai_jobs WHERE id = $1', [inserted.rows[0]!.id]);
    expect(stored.rows[0]).toEqual({ status: 'CANCELLED', request_id: '22222222-2222-4222-8222-222222222222' });
  });

  it('reclaims a stale job through the real membership role and terminates it when attempts are exhausted', async () => {
    const inserted = await controlPool.query<{ id: string }>(`INSERT INTO ai_jobs (school_id, user_id, input, status, stage, progress, attempt_count, max_attempts, next_attempt_at, lease_expires_at, deadline_at, request_id)
      VALUES ($1, $2, '{"message":"stale job","reasoningMode":"THINKING"}'::jsonb, 'RUNNING', 'REASONING', 0, 0, 1, now(), now() - interval '1 minute', now() + interval '5 minutes', '66666666-6666-4666-8666-666666666666') RETURNING id`, [student.schoolId, student.userId]);
    const repository = new PostgresPlatformRepository({ apiPool, controlPool });
    await repository.recoverPendingAiJobs();
    const stored = await controlPool.query<{ status: string; stage: string; progress: number; attempt_count: number }>('SELECT status, stage, progress, attempt_count FROM ai_jobs WHERE id = $1', [inserted.rows[0]!.id]);
    expect(stored.rows[0]).toEqual({ status: 'FAILED', stage: 'FAILED', progress: 100, attempt_count: 1 });
  });
});
