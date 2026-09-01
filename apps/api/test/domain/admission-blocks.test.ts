import { describe, expect, it } from 'vitest';
import { clampPriorityBonus, EXAM_BLOCKS, isValidExamBlock, pickBestBlockScore } from '../../src/domain/career/admission-blocks.js';

describe('admission blocks', () => {
  it('loads the 2025 dictionary and still accepts rare codes that match A00-style pattern', () => {
    expect(EXAM_BLOCKS).toHaveLength(98);
    expect(isValidExamBlock('A00')).toBe(true);
    expect(isValidExamBlock('X06')).toBe(true);
    expect(isValidExamBlock('Y07')).toBe(true);
    expect(isValidExamBlock('Z99')).toBe(true);
    expect(isValidExamBlock('bad')).toBe(false);
  });

  it('picks the highest-scoring block the student can fully cover', () => {
    const best = pickBestBlockScore({ TOAN: 9, LY: 8, HOA: 7, ANH: 9.5 });
    expect(best).toMatchObject({ block: 'A01', score: 26.5 });
  });

  it('maps GDCD to GDKTPL when scoring civic combinations', () => {
    const best = pickBestBlockScore({ VAN: 8, SU: 7, GDCD: 9 }, ['X70']);
    expect(best).toMatchObject({ block: 'X70', score: 24 });
  });

  it('ignores blocks with missing subject scores and returns null when none are complete', () => {
    expect(pickBestBlockScore({ TOAN: 9 })).toBeNull();
    const restricted = pickBestBlockScore({ TOAN: 8, VAN: 7, ANH: 9 }, ['D01']);
    expect(restricted).toMatchObject({ block: 'D01', score: 24 });
  });

  it('clamps priority bonus to the regulatory maximum', () => {
    expect(clampPriorityBonus(5)).toBe(2.75);
    expect(clampPriorityBonus(-1)).toBe(0);
    expect(clampPriorityBonus(1.5)).toBe(1.5);
  });
});
