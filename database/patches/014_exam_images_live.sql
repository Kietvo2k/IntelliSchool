-- Live volume backfill: passage figures for seeded exam MCQs (seed skipped on existing users).
UPDATE question_versions qv
SET prompt = qv.prompt || jsonb_build_object(
  'imageSvg',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140"><rect width="240" height="140" fill="#e8eef6"/><rect x="70" y="30" width="100" height="80" rx="4" fill="#0b4a8c"/><rect x="78" y="38" width="84" height="64" fill="#fff"/><text x="120" y="74" text-anchor="middle" font-size="11" fill="#08366a">Truyen Kieu</text></svg>'
)
FROM assignment_items ai
JOIN assignments a ON a.id = ai.assignment_id
WHERE qv.id = ai.question_version_id
  AND a.title = 'Thi thử Ngữ văn trường'
  AND ai.position = 1
  AND NOT (qv.prompt ? 'imageSvg');

UPDATE question_versions qv
SET prompt = qv.prompt || jsonb_build_object(
  'imageSvg',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140"><rect width="240" height="140" fill="#e8eef6"/><path d="M20 90 Q80 20 120 70 T220 50" fill="none" stroke="#08366a" stroke-width="3"/><line x1="20" y1="110" x2="220" y2="110" stroke="#0b4a8c"/><text x="120" y="130" text-anchor="middle" font-size="12" fill="#08366a">y = sin x</text></svg>'
)
FROM assignment_items ai
JOIN assignments a ON a.id = ai.assignment_id
WHERE qv.id = ai.question_version_id
  AND a.title = 'Thi thử Toán trường'
  AND ai.position = 2
  AND NOT (qv.prompt ? 'imageSvg');
