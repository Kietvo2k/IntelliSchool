export type AiModelTier = 'LOCAL_FAST' | 'LOCAL_QUALITY' | 'CLOUD';

export interface AiModelCandidate {
  id: string;
  tier: AiModelTier;
  enabled: boolean;
}

export interface AiQualityEvidence {
  schemaValid: boolean;
  hasEnoughEvidence: boolean;
  rubricChecked: boolean;
  localQualityPassed: boolean;
}

export type AiExecutionDecision = { modelId: string; reason: 'LOCAL_FAST_PASSED' | 'LOCAL_QUALITY_PASSED' | 'CLOUD_FALLBACK_QUALITY_GATE' } | { modelId: null; reason: 'NO_ELIGIBLE_MODEL' };

function firstEnabled(models: readonly AiModelCandidate[], tier: AiModelTier): AiModelCandidate | undefined {
  return models.find((model) => model.tier === tier && model.enabled);
}

/** Model selection is deterministic. A model self-reported confidence is never a gate. */
export function chooseAiExecution(models: readonly AiModelCandidate[], quality: AiQualityEvidence): AiExecutionDecision {
  const localFast = firstEnabled(models, 'LOCAL_FAST');
  const localQuality = firstEnabled(models, 'LOCAL_QUALITY');
  const cloud = firstEnabled(models, 'CLOUD');
  const allQualityGatesPass = quality.schemaValid && quality.hasEnoughEvidence && quality.rubricChecked;
  if (localFast && allQualityGatesPass && quality.localQualityPassed) return { modelId: localFast.id, reason: 'LOCAL_FAST_PASSED' };
  if (localQuality && allQualityGatesPass && quality.localQualityPassed) return { modelId: localQuality.id, reason: 'LOCAL_QUALITY_PASSED' };
  if (cloud) return { modelId: cloud.id, reason: 'CLOUD_FALLBACK_QUALITY_GATE' };
  return { modelId: null, reason: 'NO_ELIGIBLE_MODEL' };
}

export interface RagChunkScope {
  id: string;
  schoolId: string;
  classId: string | null;
  subjectId: string | null;
}

export function filterRagChunks<T extends RagChunkScope>(chunks: readonly T[], scope: { schoolId: string; classId: string; subjectId: string }): T[] {
  return chunks.filter((chunk) => chunk.schoolId === scope.schoolId && chunk.classId === scope.classId && chunk.subjectId === scope.subjectId);
}
