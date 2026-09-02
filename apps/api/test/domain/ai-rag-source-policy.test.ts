import { describe, expect, it } from 'vitest';
import { isStudyRagSourceKind } from '../../src/domain/ai/rag-source-policy.js';

describe('AI study RAG source policy', () => {
  it('keeps citations limited to learning materials, not learner profiles or career memory', () => {
    expect(isStudyRagSourceKind('RESOURCE')).toBe(true);
    expect(isStudyRagSourceKind('LESSON')).toBe(true);
    expect(isStudyRagSourceKind('TEXT')).toBe(true);
    expect(isStudyRagSourceKind('LEARNER_PROFILE')).toBe(false);
    expect(isStudyRagSourceKind('GRADEBOOK')).toBe(false);
    expect(isStudyRagSourceKind('CAREER_SNAPSHOT')).toBe(false);
    expect(isStudyRagSourceKind('CHAT_MEMORY')).toBe(false);
  });
});
