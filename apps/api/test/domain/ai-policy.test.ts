import { describe, expect, it } from 'vitest';
import { chooseAiExecution, filterRagChunks } from '../../src/domain/ai/policy.js';

describe('AI provider and RAG security policy', () => {
  it('only permits a cloud fallback after deterministic quality gates fail and a cloud model is enabled', () => {
    const models = [
      { id: 'fast', tier: 'LOCAL_FAST' as const, enabled: true },
      { id: 'quality', tier: 'LOCAL_QUALITY' as const, enabled: true },
      { id: 'cloud', tier: 'CLOUD' as const, enabled: true },
    ];
    expect(chooseAiExecution(models, { schemaValid: true, hasEnoughEvidence: true, rubricChecked: true, localQualityPassed: true })).toEqual({ modelId: 'fast', reason: 'LOCAL_FAST_PASSED' });
    expect(chooseAiExecution(models, { schemaValid: true, hasEnoughEvidence: false, rubricChecked: true, localQualityPassed: false })).toEqual({ modelId: 'cloud', reason: 'CLOUD_FALLBACK_QUALITY_GATE' });
  });

  it('filters RAG chunks by the exact school and the allowed class/subject scope', () => {
    const chunks = [
      { id: 'ok', schoolId: 'school-a', classId: 'class-a', subjectId: 'math' },
      { id: 'school-wide', schoolId: 'school-a', classId: null, subjectId: null },
      { id: 'other-school', schoolId: 'school-b', classId: 'class-a', subjectId: 'math' },
      { id: 'other-subject', schoolId: 'school-a', classId: 'class-a', subjectId: 'physics' },
      { id: 'other-class', schoolId: 'school-a', classId: 'class-b', subjectId: 'math' },
    ];
    expect(filterRagChunks(chunks, { schoolId: 'school-a', classIds: ['class-a'], subjectId: 'math' }).map((chunk) => chunk.id)).toEqual(['ok', 'school-wide']);
  });
});
