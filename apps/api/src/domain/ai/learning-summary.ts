export interface ProgressStudentSummary {
  displayName: string;
  completionPercent: number;
  averagePercent: number;
  trend: 'IMPROVING' | 'DECLINING' | 'STABLE' | 'NO_DATA';
  needsSupport: boolean;
}

/** Tóm tắt tình trạng lớp — chạy backend, UI chỉ hiển thị. */
export function summarizeClassProgress(students: readonly ProgressStudentSummary[]): string {
  if (students.length === 0) return 'Chưa có dữ liệu tiến độ cho lớp này.';
  const support = students.filter((item) => item.needsSupport);
  const declining = students.filter((item) => item.trend === 'DECLINING');
  const improving = students.filter((item) => item.trend === 'IMPROVING');
  const avg = Math.round(students.reduce((sum, item) => sum + item.averagePercent, 0) / students.length);
  const parts = [
    `Lớp có ${students.length} học sinh; điểm trung bình khoảng ${avg}%.`,
    support.length ? `${support.length} em cần hỗ trợ (hoàn thành thấp hoặc điểm dưới 50%).` : 'Chưa có tín hiệu cần hỗ trợ theo ngưỡng hiện tại.',
    declining.length ? `Xu hướng giảm: ${declining.map((item) => item.displayName).slice(0, 5).join(', ')}.` : '',
    improving.length ? `Đang tiến bộ: ${improving.map((item) => item.displayName).slice(0, 5).join(', ')}.` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

export function summarizeStudentGrades(entries: Array<{ subjectName?: string; subjectCode?: string; score: number; maxScore: number }>): string {
  if (entries.length === 0) return 'Chưa có điểm được ghi nhận. Hãy hoàn thành bài tập đã mở để có bức tranh học lực.';
  const percents = entries.map((entry) => entry.maxScore > 0 ? (entry.score / entry.maxScore) * 100 : 0);
  const avg = Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length);
  const weakest = [...entries].sort((left, right) => (left.score / left.maxScore) - (right.score / right.maxScore))[0];
  const label = weakest?.subjectName ?? weakest?.subjectCode ?? 'một môn';
  if (avg < 50) return `Điểm trung bình khoảng ${avg}%. Ưu tiên ôn ${label} và nộp đủ bài còn thiếu.`;
  if (avg < 70) return `Điểm trung bình khoảng ${avg}%. Giữ nhịp làm bài; môn cần cải thiện trước: ${label}.`;
  return `Điểm trung bình khoảng ${avg}%. Tiếp tục duy trì; nếu muốn nâng band, tập trung ${label}.`;
}
