import { directPrerequisites, topologicalOrder, type SkillGraphDefinition } from './graph.js';

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

export type DiagnosisStatus = 'ACTIONABLE' | 'NEEDS_MORE_EVIDENCE' | 'ON_TRACK';

export interface SkillGapSummary {
  skillCode: string;
  incorrectCount: number;
  totalCount: number;
  evidenceEventIds: string[];
}

export interface RootCauseDiagnosis {
  status: DiagnosisStatus;
  rootSkillCode: string | null;
  /** Kỹ năng đã đủ bằng chứng sai (>= minEvidence), xếp theo thứ tự tiên quyết. */
  affectedSkills: SkillGapSummary[];
  /** Kỹ năng có dấu hiệu sai nhưng chưa đủ bằng chứng để kết luận. */
  suspectedSkills: SkillGapSummary[];
  evidenceEventIds: string[];
  reasonCodes: string[];
}

/**
 * Chẩn đoán lỗ hổng gốc trên đồ thị đã duyệt: tìm kỹ năng TIÊN QUYẾT SỚM NHẤT (theo
 * thứ tự tô-pô) có đủ bằng chứng sai. Khi chỉ có bằng chứng lẻ tẻ (< minEvidence) thì
 * trả NEEDS_MORE_EVIDENCE thay vì gán nhãn học sinh. Hoàn toàn tất định.
 */
export function diagnoseRootCause(input: {
  graph: SkillGraphDefinition;
  events: readonly LearningEvent[];
  minEvidence?: number;
}): RootCauseDiagnosis {
  const minEvidence = input.minEvidence ?? 2;
  if (!Number.isInteger(minEvidence) || minEvidence < 1) throw new Error('minEvidence must be a positive integer');

  const graphSkills = new Set(input.graph.skills.map((skill) => skill.code));
  const perSkill = new Map<string, { incorrect: LearningEvent[]; total: number }>();
  for (const event of input.events) {
    if (!event.id || !event.skillCode || !Number.isFinite(Date.parse(event.occurredAt))) throw new Error('Learning evidence is incomplete');
    if (!graphSkills.has(event.skillCode)) continue; // chỉ xét kỹ năng thuộc đồ thị đã duyệt
    const bucket = perSkill.get(event.skillCode) ?? { incorrect: [], total: 0 };
    bucket.total += 1;
    if (!event.correct) bucket.incorrect.push(event);
    perSkill.set(event.skillCode, bucket);
  }

  const order = topologicalOrder(input.graph);
  const rank = new Map(order.map((code, index) => [code, index]));
  const toSummary = (skillCode: string, bucket: { incorrect: LearningEvent[]; total: number }): SkillGapSummary => ({
    skillCode,
    incorrectCount: bucket.incorrect.length,
    totalCount: bucket.total,
    evidenceEventIds: bucket.incorrect.map((event) => event.id).sort(),
  });

  const affected: SkillGapSummary[] = [];
  const suspected: SkillGapSummary[] = [];
  for (const [skillCode, bucket] of perSkill) {
    if (bucket.incorrect.length === 0) continue;
    if (bucket.incorrect.length >= minEvidence) affected.push(toSummary(skillCode, bucket));
    else suspected.push(toSummary(skillCode, bucket));
  }
  const byPrerequisite = (left: SkillGapSummary, right: SkillGapSummary) =>
    (rank.get(left.skillCode) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.skillCode) ?? Number.MAX_SAFE_INTEGER)
    || left.skillCode.localeCompare(right.skillCode);
  affected.sort(byPrerequisite);
  suspected.sort(byPrerequisite);

  if (affected.length === 0) {
    return {
      status: suspected.length > 0 ? 'NEEDS_MORE_EVIDENCE' : 'ON_TRACK',
      rootSkillCode: null,
      affectedSkills: [],
      suspectedSkills: suspected,
      evidenceEventIds: [],
      reasonCodes: suspected.length > 0 ? ['INSUFFICIENT_DIRECT_EVIDENCE'] : ['NO_GAP_DETECTED'],
    };
  }

  const root = affected[0]!;
  return {
    status: 'ACTIONABLE',
    rootSkillCode: root.skillCode,
    affectedSkills: affected,
    suspectedSkills: suspected,
    evidenceEventIds: root.evidenceEventIds,
    reasonCodes: ['APPROVED_EVIDENCE_PATTERN'],
  };
}

/**
 * Lộ trình ôn tập: các kỹ năng cần ôn được xếp theo thứ tự tiên quyết, không bao giờ
 * hiện một kỹ năng trước khi tiên quyết (cũng đang cần ôn) của nó xuất hiện.
 */
export function planRemediationPath(input: {
  graph: SkillGraphDefinition;
  gapSkillCodes: readonly string[];
}): Array<{ skillCode: string; unmetPrerequisites: string[] }> {
  const gaps = new Set(input.gapSkillCodes.filter((code) => code));
  const order = topologicalOrder(input.graph);
  return order
    .filter((code) => gaps.has(code))
    .map((code) => ({ skillCode: code, unmetPrerequisites: directPrerequisites(input.graph, code).filter((prerequisite) => gaps.has(prerequisite)) }));
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
