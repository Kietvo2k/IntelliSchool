import { describe, expect, it } from 'vitest';
import { buildAdaptiveInsight, buildReviewSchedule } from '../../src/domain/learning/adaptive.js';

describe('adaptive learning guardrails', () => {
  const events = [
    { id: 'e1', skillCode: 'DERIVATIVE', correct: false, occurredAt: '2026-07-23T08:00:00.000Z' },
    { id: 'e2', skillCode: 'DERIVATIVE', correct: false, occurredAt: '2026-07-23T09:00:00.000Z' },
  ];

  it('keeps insight as a report when the graph or item mappings have not been approved', () => {
    expect(buildAdaptiveInsight({ events, graphApproved: false, mappingsApproved: true })).toEqual(expect.objectContaining({ mode: 'REPORT_ONLY', rootSkillCode: null, reasonCodes: ['UNAPPROVED_SKILL_GRAPH'] }));
    expect(buildAdaptiveInsight({ events, graphApproved: true, mappingsApproved: false })).toEqual(expect.objectContaining({ mode: 'REPORT_ONLY', rootSkillCode: null, reasonCodes: ['UNAPPROVED_ITEM_MAPPING'] }));
  });

  it('creates an explainable suggestion and an idempotent review schedule only from approved evidence', () => {
    const insight = buildAdaptiveInsight({ events, graphApproved: true, mappingsApproved: true, minimumEvidence: 2 });
    expect(insight).toMatchObject({ mode: 'ACTIONABLE_SUGGESTION', rootSkillCode: 'DERIVATIVE', evidenceEventIds: ['e1', 'e2'], teacherOverrideRequired: false });
    expect(buildReviewSchedule({ sourceEventId: 'e2', skillCode: 'DERIVATIVE', occurredAt: events[1]!.occurredAt, correct: false })).toEqual(expect.objectContaining({ idempotencyKey: 'review-e2', intervalDays: 1, reason: 'REMEDIATE_SOON' }));
  });
});
