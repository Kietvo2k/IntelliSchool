import { describe, expect, it } from 'vitest';
import { seedFromUuid, shuffleWithSeed } from '../../src/domain/career/exam-shuffle.js';

describe('exam shuffle', () => {
  it('is deterministic for the same seed', () => {
    const items = [1, 2, 3, 4, 5];
    const seed = seedFromUuid('11111111-1111-4111-8111-111111111111');
    expect(shuffleWithSeed(items, seed)).toEqual(shuffleWithSeed(items, seed));
    expect(shuffleWithSeed(items, seed).sort()).toEqual(items);
  });
});
