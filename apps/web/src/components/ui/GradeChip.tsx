import { subjectLabel } from '../../lib/subject-labels.js';

export function GradeChip({ code, score }: { code: string; score: number }) {
  return (
    <span className="grade-chip">
      <b>{subjectLabel(code)}</b>
      <strong>{score.toFixed(1)}</strong>
    </span>
  );
}
