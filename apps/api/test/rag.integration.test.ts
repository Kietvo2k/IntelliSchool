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

  it('ingests text, retrieves relevant chunks and answers with citations (local fallback)', async () => {
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

    const reply = await repository.chatWithAi(student, { message: 'Giải thích ngắn gọn quang hợp' }, 'rag-chat-int-1') as { mode: string; message: { content: string; citations: unknown[] } };
    expect(['GROUNDED', 'GENERAL']).toContain(reply.mode);
    expect(reply.message.content.length).toBeGreaterThan(0);
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
    expect(status?.status).toBe('COMPLETED');
    expect(status?.progress).toBe(100);
    expect(status?.result?.message?.content).toBeTruthy();
    expect(status?.isFallback).toBe(true);
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
      is_fallback: true,
      input_tokens: expect.any(Number),
      output_tokens: expect.any(Number),
      estimated_cost_vnd: expect.any(String),
      tool_trace: expect.any(Array),
    }));
  });
});
