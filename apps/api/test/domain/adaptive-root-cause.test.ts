import { describe, expect, it } from 'vitest';
import { diagnoseRootCause, planRemediationPath, type LearningEvent } from '../../src/domain/learning/adaptive.js';
import type { SkillGraphDefinition } from '../../src/domain/learning/graph.js';

const graph: SkillGraphDefinition = {
  skills: [
    { code: 'SIMPLIFY', name: 'Rút gọn phân số' },
    { code: 'ADD', name: 'Cộng phân số' },
    { code: 'RATIO', name: 'Tỉ lệ thức' },
  ],
  edges: [
    { prerequisite: 'SIMPLIFY', skill: 'ADD' },
    { prerequisite: 'ADD', skill: 'RATIO' },
  ],
};

function event(id: string, skillCode: string, correct: boolean): LearningEvent {
  return { id, skillCode, correct, occurredAt: '2026-08-25T00:00:00.000Z' };
}

describe('adaptive root-cause diagnosis', () => {
  it('names the earliest prerequisite with enough incorrect evidence', () => {
    const diagnosis = diagnoseRootCause({
      graph,
      events: [event('e1', 'ADD', false), event('e2', 'ADD', false), event('e3', 'SIMPLIFY', false), event('e4', 'SIMPLIFY', false), event('e5', 'RATIO', false), event('e6', 'RATIO', false)],
    });
    expect(diagnosis.status).toBe('ACTIONABLE');
    expect(diagnosis.rootSkillCode).toBe('SIMPLIFY');
    expect(diagnosis.evidenceEventIds).toEqual(['e3', 'e4']);
    expect(diagnosis.affectedSkills.map((skill) => skill.skillCode)).toEqual(['SIMPLIFY', 'ADD', 'RATIO']);
  });

  it('abstains with NEEDS_MORE_EVIDENCE when only a single incorrect answer exists', () => {
    const diagnosis = diagnoseRootCause({ graph, events: [event('e1', 'ADD', false), event('e2', 'ADD', true)] });
    expect(diagnosis.status).toBe('NEEDS_MORE_EVIDENCE');
    expect(diagnosis.rootSkillCode).toBeNull();
    expect(diagnosis.suspectedSkills.map((skill) => skill.skillCode)).toEqual(['ADD']);
  });

  it('reports ON_TRACK when there is no incorrect evidence', () => {
    const diagnosis = diagnoseRootCause({ graph, events: [event('e1', 'ADD', true), event('e2', 'RATIO', true)] });
    expect(diagnosis.status).toBe('ON_TRACK');
    expect(diagnosis.reasonCodes).toContain('NO_GAP_DETECTED');
  });

  it('ignores events for skills outside the approved graph', () => {
    const diagnosis = diagnoseRootCause({ graph, events: [event('e1', 'UNKNOWN', false), event('e2', 'UNKNOWN', false)] });
    expect(diagnosis.status).toBe('ON_TRACK');
  });

  it('plans a remediation path in prerequisite order and never before prerequisites', () => {
    const path = planRemediationPath({ graph, gapSkillCodes: ['RATIO', 'SIMPLIFY'] });
    expect(path.map((step) => step.skillCode)).toEqual(['SIMPLIFY', 'RATIO']);
    // RATIO's direct prerequisite ADD is not a gap, so it is not listed as unmet.
    expect(path.find((step) => step.skillCode === 'RATIO')?.unmetPrerequisites).toEqual([]);
  });
});
