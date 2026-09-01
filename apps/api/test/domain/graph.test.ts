import { describe, expect, it } from 'vitest';
import {
  detectCycle,
  directPrerequisites,
  normalizeSkillGraphDefinition,
  topologicalOrder,
  validateSkillGraphDefinition,
  type SkillGraphDefinition,
} from '../../src/domain/learning/graph.js';

const validGraph: SkillGraphDefinition = {
  skills: [
    { code: 'FRACTION_ADD', name: 'Cộng phân số' },
    { code: 'FRACTION_SIMPLIFY', name: 'Rút gọn phân số' },
    { code: 'RATIO', name: 'Tỉ lệ thức' },
  ],
  edges: [
    { prerequisite: 'FRACTION_SIMPLIFY', skill: 'FRACTION_ADD' },
    { prerequisite: 'FRACTION_ADD', skill: 'RATIO' },
  ],
};

describe('skill graph domain', () => {
  it('accepts a valid DAG and orders prerequisites first', () => {
    const validation = validateSkillGraphDefinition(validGraph);
    expect(validation).toEqual({ valid: true, errors: [] });
    expect(detectCycle(validGraph)).toBe(false);
    const order = topologicalOrder(validGraph);
    expect(order.indexOf('FRACTION_SIMPLIFY')).toBeLessThan(order.indexOf('FRACTION_ADD'));
    expect(order.indexOf('FRACTION_ADD')).toBeLessThan(order.indexOf('RATIO'));
  });

  it('detects a prerequisite cycle and refuses to order it', () => {
    const cyclic: SkillGraphDefinition = {
      skills: [
        { code: 'A', name: 'Kỹ năng A' },
        { code: 'B', name: 'Kỹ năng B' },
      ],
      edges: [
        { prerequisite: 'A', skill: 'B' },
        { prerequisite: 'B', skill: 'A' },
      ],
    };
    expect(detectCycle(cyclic)).toBe(true);
    const validation = validateSkillGraphDefinition(cyclic);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((message) => message.includes('chu trình'))).toBe(true);
    expect(() => topologicalOrder(cyclic)).toThrow();
  });

  it('rejects duplicate codes, dangling edges and self-loops', () => {
    const duplicate = validateSkillGraphDefinition({
      skills: [
        { code: 'A', name: 'A1' },
        { code: 'A', name: 'A2' },
      ],
      edges: [],
    });
    expect(duplicate.valid).toBe(false);
    expect(duplicate.errors.some((message) => message.includes('trùng'))).toBe(true);

    const dangling = validateSkillGraphDefinition({
      skills: [{ code: 'A', name: 'A' }],
      edges: [{ prerequisite: 'A', skill: 'MISSING' }],
    });
    expect(dangling.valid).toBe(false);
    expect(dangling.errors.some((message) => message.includes('không tồn tại'))).toBe(true);

    const selfLoop = validateSkillGraphDefinition({
      skills: [{ code: 'A', name: 'A' }],
      edges: [{ prerequisite: 'A', skill: 'A' }],
    });
    expect(selfLoop.valid).toBe(false);
    expect(selfLoop.errors.some((message) => message.includes('chính nó'))).toBe(true);
  });

  it('normalizes arbitrary jsonb into a typed definition', () => {
    const normalized = normalizeSkillGraphDefinition({
      skills: [{ code: ' A ', name: ' Kỹ năng ', description: '  ', extra: 1 }, 'invalid'],
      edges: [{ prerequisite: ' A ', skill: ' B ', note: 'x' }],
      junk: true,
    });
    expect(normalized.skills).toEqual([{ code: 'A', name: 'Kỹ năng' }]);
    expect(normalized.edges).toEqual([{ prerequisite: 'A', skill: 'B' }]);
  });

  it('lists direct prerequisites of a skill', () => {
    expect(directPrerequisites(validGraph, 'RATIO')).toEqual(['FRACTION_ADD']);
    expect(directPrerequisites(validGraph, 'FRACTION_SIMPLIFY')).toEqual([]);
  });
});
