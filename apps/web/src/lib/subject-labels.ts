export const SUBJECT_LABELS: Record<string, string> = {
  TOAN: 'Toán',
  VAN: 'Ngữ văn',
  ANH: 'Ngoại ngữ 1',
  LY: 'Vật lí',
  HOA: 'Hóa học',
  SINH: 'Sinh học',
  SU: 'Lịch sử',
  DIA: 'Địa lí',
  GDKTPL: 'GDKTPL',
  GDCD: 'GDCD',
  TIN: 'Tin học',
  math: 'Toán',
  physics: 'Vật lí',
  chemistry: 'Hóa học',
  biology: 'Sinh học',
  literature: 'Ngữ văn',
  history: 'Lịch sử',
  geography: 'Địa lí',
  civicEducation: 'GDKTPL',
};

export function subjectLabel(code: string): string {
  return SUBJECT_LABELS[code] ?? code;
}
