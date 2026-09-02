import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresPlatformRepository } from '../src/repositories/postgres-platform.js';
import { pilotAccounts, resetAndSeedPilotData } from '../src/seed-pilot.js';
import type { AuthContext } from '../src/types.js';

const controlPool = new pg.Pool({ connectionString: process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass' });
const apiPool = new pg.Pool({ connectionString: process.env.SMARTPATH_TEST_API_DATABASE_URL ?? 'postgres://smartpath_api:smartpath_api_local_only@127.0.0.1:5433/smartclass' });
const liveConfigured = Boolean(process.env.AI_OPENAI_API_KEY && process.env.AI_OPENAI_BASE_URL && process.env.AI_OPENAI_MODEL);
const runLive = liveConfigured || process.env.AI_LIVE_REQUIRED === 'true';

async function contextFor(email: string): Promise<AuthContext> {
  const row = await controlPool.query<{ id: string; email: string; display_name: string; role: string; school_id: string }>(
    'SELECT u.id, u.email::text, u.display_name, m.role::text, m.school_id FROM users u JOIN school_memberships m ON m.user_id = u.id WHERE u.email = $1 LIMIT 1',
    [email],
  );
  const record = row.rows[0]!;
  return { userId: record.id, email: record.email, displayName: record.display_name, role: record.role as AuthContext['role'], schoolId: record.school_id };
}

describe.skipIf(!runLive)('AI runtime live integration evidence', () => {
  let repository: PostgresPlatformRepository;
  let student: AuthContext;
  let teacher: AuthContext;
  let firstCase = true;

  beforeEach(async () => {
    if (firstCase) {
      firstCase = false;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  });

  beforeAll(async () => {
    expect(liveConfigured).toBe(true);
    await resetAndSeedPilotData(controlPool);
    student = await contextFor(pilotAccounts.student.email);
    teacher = await contextFor(pilotAccounts.teacher.email);
    repository = new PostgresPlatformRepository({ apiPool, controlPool });
  });

  afterAll(async () => {
    await repository?.close();
  });

  it('runs live grounded chat with model, usage, citations and request evidence', async () => {
    const requestId = '11111111-1111-4111-8111-111111111111';
    const reply = await repository.chatWithAi(student, { message: 'Giải thích ngắn gọn đạo hàm của x bình phương.' }, 'live-chat-2026-09-02', requestId) as { executionMode: string; provider: string | null; usedModel: string | null; requestId: string; usage: { inputTokens: number; outputTokens: number }; citations: unknown[]; message: { citations: unknown[] } };
    expect(reply.executionMode).toBe('MODEL');
    expect(reply.provider).toBe('OPENAI_COMPATIBLE');
    expect(reply.usedModel).toBe(process.env.AI_OPENAI_MODEL);
    expect(reply.requestId).toBe(requestId);
    expect(reply.usage.inputTokens).toBeGreaterThan(0);
    expect(reply.usage.outputTokens).toBeGreaterThan(0);
    expect(reply.message.citations.length).toBeGreaterThan(0);
  }, 180_000);

  it('runs live teacher compose through structured output validation', async () => {
    const reply = await repository.chatWithAi(teacher, { purpose: 'TEACHER_COMPOSE', message: 'Xác nhận sinh đề: 5 trắc nghiệm, 0 đúng/sai, 0 ngắn, 0 tự luận; môn Toán, chương đạo hàm, độ khó dễ.' }, 'live-compose-2026-09-02', '22222222-2222-4222-8222-222222222222') as { executionMode: string; usedModel: string | null; requestId: string; usage: { inputTokens: number; outputTokens: number }; message: { raw?: string } };
    expect(reply.executionMode).toBe('MODEL');
    expect(reply.usedModel).toBe(process.env.AI_OPENAI_MODEL);
    expect(reply.requestId).toBe('22222222-2222-4222-8222-222222222222');
    expect(reply.usage.inputTokens).toBeGreaterThan(0);
    expect(JSON.parse(reply.message.raw ?? '{}').questions).toHaveLength(5);
  }, 180_000);

  it('runs live career analysis and aptitude essay grading with evidence', async () => {
    const career = await repository.analyzeCareer(student, { agentTypes: ['ACADEMIC_ANALYST'], targetMajor: 'Khoa học Máy tính' }, 'live-career-2026-09-02', '33333333-3333-4333-8333-333333333333') as { executionMode: string; provider: string; usedModel: string; requestId: string; usage: { inputTokens: number; outputTokens: number } };
    expect(career.executionMode).toBe('MODEL');
    expect(career.provider).toBe('OPENAI_COMPATIBLE');
    expect(career.usedModel).toBe(process.env.AI_OPENAI_MODEL);
    expect(career.requestId).toBe('33333333-3333-4333-8333-333333333333');
    expect(career.usage.inputTokens).toBeGreaterThan(0);
    expect(career.usage.outputTokens).toBeGreaterThan(0);

    const aptitude = await repository.saveAptitudeAssessment(student, { H7e: 'Vận tốc trung bình là tổng quãng đường chia tổng thời gian, không phải trung bình cộng hai vận tốc.' }, 'live-aptitude-2026-09-02', '44444444-4444-4444-8444-444444444444') as { executionMode: string; provider: string; usedModel: string; requestId: string; usage: { inputTokens: number; outputTokens: number } };
    expect(aptitude.executionMode).toBe('MODEL');
    expect(aptitude.provider).toBe('OPENAI_COMPATIBLE');
    expect(aptitude.usedModel).toBe(process.env.AI_OPENAI_MODEL);
    expect(aptitude.requestId).toBe('44444444-4444-4444-8444-444444444444');
    expect(aptitude.usage.inputTokens).toBeGreaterThan(0);
  }, 180_000);

  it('runs live Thinking through the durable job and preserves request evidence', async () => {
    const queued = await repository.createAiJob(student, { message: 'Giải thích đạo hàm bằng ví dụ.', purpose: 'PERSONAL_STUDY', reasoningMode: 'THINKING' }, 'live-thinking-2026-09-02', '55555555-5555-4555-8555-555555555555') as { jobId: string; requestId: string };
    expect(queued.requestId).toBe('55555555-5555-4555-8555-555555555555');
    let status: { status: string; requestId: string; usedModel: string | null; usage: { inputTokens: number; outputTokens: number }; result?: { requestId?: string } } | null = null;
    for (let attempt = 0; attempt < 240; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      status = await repository.getAiJob(student, queued.jobId) as typeof status;
      if (status.status === 'COMPLETED' || status.status === 'FAILED') break;
    }
    expect(status?.status).toBe('COMPLETED');
    expect(status?.requestId).toBe('55555555-5555-4555-8555-555555555555');
    expect(status?.usedModel).toBe(process.env.AI_OPENAI_MODEL);
    expect(status?.usage.inputTokens).toBeGreaterThan(0);
    expect(status?.result?.requestId).toBe('55555555-5555-4555-8555-555555555555');
  }, 180_000);
});
