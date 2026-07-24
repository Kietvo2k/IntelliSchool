export interface LearningEvent {
  id: string;
  skillCode: string;
  correct: boolean;
  occurredAt: string;
}

export interface AdaptiveInsight {
  mode: 'REPORT_ONLY' | 'ACTIONABLE_SUGGESTION';
  rootSkillCode: string | null;
  evidenceEventIds: string[];
  reasonCodes: string[];
  teacherOverrideRequired: boolean;
}

export interface ReviewSchedule {
  idempotencyKey: string;
  skillCode: string;
  dueAt: string;
  intervalDays: 1 | 3 | 7 | 14 | 30;
  reason: 'REMEDIATE_SOON' | 'RECOVERY_CHECK' | 'SPACED_REVIEW';
}

function addUtcDays(occurredAt: string, days: number): string {
  const timestamp = Date.parse(occurredAt);
  if (!Number.isFinite(timestamp)) throw new Error('occurredAt must be a valid ISO date');
  return new Date(timestamp + days * 86_400_000).toISOString();
}

/** Do not infer a root cause until both the graph and each item mapping are human approved. */
export function buildAdaptiveInsight(input: {
  events: readonly LearningEvent[];
  graphApproved: boolean;
  mappingsApproved: boolean;
  minimumEvidence?: number;
}): AdaptiveInsight {
  if (!input.graphApproved) return { mode: 'REPORT_ONLY', rootSkillCode: null, evidenceEventIds: [], reasonCodes: ['UNAPPROVED_SKILL_GRAPH'], teacherOverrideRequired: true };
  if (!input.mappingsApproved) return { mode: 'REPORT_ONLY', rootSkillCode: null, evidenceEventIds: [], reasonCodes: ['UNAPPROVED_ITEM_MAPPING'], teacherOverrideRequired: true };
  const minimumEvidence = input.minimumEvidence ?? 2;
  if (!Number.isInteger(minimumEvidence) || minimumEvidence < 1) throw new Error('minimumEvidence must be a positive integer');
  const incorrectBySkill = new Map<string, LearningEvent[]>();
  for (const event of input.events) {
    if (!event.id || !event.skillCode || !Number.isFinite(Date.parse(event.occurredAt))) throw new Error('Learning evidence is incomplete');
    if (event.correct) continue;
    incorrectBySkill.set(event.skillCode, [...(incorrectBySkill.get(event.skillCode) ?? []), event]);
  }
  const selected = [...incorrectBySkill.entries()]
    .filter(([, events]) => events.length >= minimumEvidence)
    .sort(([leftSkill, leftEvents], [rightSkill, rightEvents]) => rightEvents.length - leftEvents.length || leftSkill.localeCompare(rightSkill))[0];
  if (!selected) return { mode: 'REPORT_ONLY', rootSkillCode: null, evidenceEventIds: [], reasonCodes: ['INSUFFICIENT_DIRECT_EVIDENCE'], teacherOverrideRequired: false };
  return { mode: 'ACTIONABLE_SUGGESTION', rootSkillCode: selected[0], evidenceEventIds: selected[1].map((event) => event.id).sort(), reasonCodes: ['APPROVED_EVIDENCE_PATTERN'], teacherOverrideRequired: false };
}

export function buildReviewSchedule(input: { sourceEventId: string; skillCode: string; occurredAt: string; correct: boolean; previousIntervalDays?: 1 | 3 | 7 | 14 | 30 }): ReviewSchedule {
  if (!input.sourceEventId || !input.skillCode) throw new Error('A review schedule needs stable source and skill IDs');
  const intervalDays: ReviewSchedule['intervalDays'] = input.correct
    ? input.previousIntervalDays === 3 ? 7 : input.previousIntervalDays === 7 ? 14 : input.previousIntervalDays === 14 || input.previousIntervalDays === 30 ? 30 : 3
    : 1;
  const reason: ReviewSchedule['reason'] = input.correct
    ? input.previousIntervalDays === undefined || input.previousIntervalDays === 1 ? 'RECOVERY_CHECK' : 'SPACED_REVIEW'
    : 'REMEDIATE_SOON';
  return { idempotencyKey: `review-${input.sourceEventId}`, skillCode: input.skillCode, dueAt: addUtcDays(input.occurredAt, intervalDays), intervalDays, reason };
}
