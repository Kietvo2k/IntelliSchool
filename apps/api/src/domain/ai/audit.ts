export interface AiAuditMetadataInput {
  operation: string;
  purpose?: string | null;
  status: 'CREATED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  stage?: string | null;
  errorCode?: string | null;
  provider?: string | null;
  requestedModel?: string | null;
  usedModel?: string | null;
  executionMode?: string | null;
  isFallback?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostVnd?: number;
  citationsCount?: number;
  toolCount?: number;
  requestId: string;
  jobId?: string | null;
  prompt?: unknown;
  apiKey?: unknown;
}

/** Chỉ phát hành bằng chứng vận hành; không bao giờ đưa prompt, output hay secret vào audit log. */
export function buildAiAuditMetadata(input: AiAuditMetadataInput): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    category: 'AI',
    operation: input.operation,
    status: input.status,
    stage: input.stage ?? null,
    errorCode: input.errorCode ?? null,
    provider: input.provider ?? null,
    requestedModel: input.requestedModel ?? null,
    usedModel: input.usedModel ?? null,
    executionMode: input.executionMode ?? null,
    isFallback: input.isFallback ?? false,
    requestId: input.requestId,
    jobId: input.jobId ?? null,
  };
  if (input.purpose !== undefined) metadata.purpose = input.purpose;
  if (input.inputTokens !== undefined) metadata.inputTokens = input.inputTokens;
  if (input.outputTokens !== undefined) metadata.outputTokens = input.outputTokens;
  if (input.estimatedCostVnd !== undefined) metadata.estimatedCostVnd = input.estimatedCostVnd;
  if (input.citationsCount !== undefined) metadata.citationsCount = input.citationsCount;
  if (input.toolCount !== undefined) metadata.toolCount = input.toolCount;
  return metadata;
}
