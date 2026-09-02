export const STUDY_RAG_SOURCE_KINDS = ['RESOURCE', 'LESSON', 'TEXT'] as const;

export function isStudyRagSourceKind(sourceKind: string): boolean {
  return (STUDY_RAG_SOURCE_KINDS as readonly string[]).includes(sourceKind);
}
