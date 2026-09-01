/** Ghép snapshot hồ sơ học sinh thành văn bản nạp knowledge base (không nhét PII thừa). */

export const LMS_TO_CAREER_SUBJECT: Record<string, string> = {
  MATH: 'TOAN', LIT: 'VAN', ENG: 'ANH', PHYS: 'LY', CHEM: 'HOA', BIO: 'SINH',
  HIST: 'SU', GEO: 'DIA', GDKTPL: 'GDKTPL', IT: 'TIN', TECH: 'CONGNGHE',
};

export function mapLmsSubjectToCareer(code: string): string {
  return LMS_TO_CAREER_SUBJECT[code] ?? code;
}

export function buildLearnerKbText(input: {
  displayName?: string;
  studentCode?: string;
  snapshot?: Record<string, unknown>;
  riasec?: Record<string, unknown>;
  goals?: string[];
  classroomGrades?: Record<string, number>;
}): string {
  const grades = input.classroomGrades ?? (input.snapshot?.classroomGrades as Record<string, number> | undefined);
  const lines = [
    input.displayName ? `Học sinh: ${input.displayName}` : '',
    input.studentCode ? `Mã: ${input.studentCode}` : '',
    grades && Object.keys(grades).length > 0 ? `Điểm học trên lớp (không phải tổ hợp ĐH): ${JSON.stringify(grades)}` : '',
    input.riasec && Object.keys(input.riasec).length > 0 ? `RIASEC: ${JSON.stringify(input.riasec)}` : '',
    input.goals && input.goals.length > 0 ? `Mục tiêu: ${input.goals.join('; ')}` : '',
    typeof input.snapshot?.province === 'string' ? `Tỉnh: ${input.snapshot.province}` : '',
  ].filter(Boolean);
  return lines.join('\n') || 'Chưa có dữ liệu hồ sơ học tập.';
}

export function classroomGradesFromEntries(entries: Array<{ subjectCode: string; score: number; maxScore: number }>): Record<string, number> {
  const buckets = new Map<string, { sum: number; n: number }>();
  for (const entry of entries) {
    if (!Number.isFinite(entry.score) || !Number.isFinite(entry.maxScore) || entry.maxScore <= 0) continue;
    const key = mapLmsSubjectToCareer(entry.subjectCode);
    const ten = (entry.score / entry.maxScore) * 10;
    const current = buckets.get(key) ?? { sum: 0, n: 0 };
    buckets.set(key, { sum: current.sum + ten, n: current.n + 1 });
  }
  return Object.fromEntries([...buckets.entries()].map(([key, value]) => [key, Math.round((value.sum / value.n) * 10) / 10]));
}

export function snapshotNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => [key, Number(item)])
    .filter(([, item]) => Number.isFinite(item)));
}

/** Sổ điểm làm nền; snapshot chỉ điền chỗ trống (HS không gõ lại điểm đã có). */
export function mergeClassroomGrades(gradebook: Record<string, number>, snapshot?: Record<string, unknown>): Record<string, number> {
  return { ...snapshotNumberRecord(snapshot), ...gradebook };
}

const SUBJECT_LABEL: Record<string, string> = {
  TOAN: 'Toán', VAN: 'Ngữ văn', ANH: 'Ngoại ngữ', LY: 'Vật lí', HOA: 'Hóa học', SINH: 'Sinh học',
  SU: 'Lịch sử', DIA: 'Địa lí', GDKTPL: 'GDKTPL', TIN: 'Tin học', CONGNGHE: 'Công nghệ',
};

export function draftSkillsFromGrades(grades: Record<string, number>): Array<{ skillCode: string; skillName: string; evidence: string }> {
  return Object.entries(grades)
    .filter(([, score]) => score < 6.5)
    .map(([code, score]) => ({
      skillCode: `REMEDIATE_${code}`,
      skillName: `Ôn ${SUBJECT_LABEL[code] ?? code}`,
      evidence: `Điểm học trên lớp ${score}/10, dưới ngưỡng 6.5 (không dùng làm tổ hợp ĐH).`,
    }));
}
