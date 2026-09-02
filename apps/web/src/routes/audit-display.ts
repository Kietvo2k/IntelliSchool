function textValue(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value : undefined; }
function numberValue(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }

export function formatAiAuditMetadata(metadata?: Record<string, unknown>): string {
  if (metadata?.category !== 'AI') return '';
  const operation = textValue(metadata.operation);
  const status = textValue(metadata.status);
  const provider = textValue(metadata.provider)?.replaceAll('_', ' ');
  const model = textValue(metadata.usedModel) ?? textValue(metadata.requestedModel);
  const stage = textValue(metadata.stage);
  const errorCode = textValue(metadata.errorCode);
  const inputTokens = numberValue(metadata.inputTokens);
  const outputTokens = numberValue(metadata.outputTokens);
  const requestId = textValue(metadata.requestId);
  const parts = [
    operation && status ? `${operation} ${status}` : operation ?? status,
    provider,
    model,
    stage,
    errorCode,
    inputTokens !== undefined && outputTokens !== undefined ? `${inputTokens} in / ${outputTokens} out` : undefined,
    requestId ? `request ${requestId}` : undefined,
  ];
  return parts.filter((part): part is string => Boolean(part)).join(' · ');
}
