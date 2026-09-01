import XlsxPopulate from 'xlsx-populate';

export interface GradebookExportRow {
  studentCode: string;
  studentName: string;
  assignmentTitle: string;
  score: number;
  maxScore: number;
  attemptCount: number;
  isLate: boolean;
  source: string;
}

export interface BuiltReportExport { bytes: Buffer; mimeType: string; extension: 'csv' | 'xlsx'; }
export interface ProgressExportRow { studentCode: string; studentName: string; completionPercent: number; averagePercent: number; trend: string; needsSupport: boolean; }

const headers = ['Mã học sinh', 'Họ tên học sinh', 'Bài tập', 'Điểm', 'Điểm tối đa', 'Phần trăm', 'Số lượt', 'Nộp trễ', 'Nguồn điểm'];

function values(rows: readonly GradebookExportRow[]): Array<Array<string | number>> {
  return rows.map((row) => [row.studentCode, row.studentName, row.assignmentTitle, row.score, row.maxScore, row.maxScore ? row.score / row.maxScore : 0, row.attemptCount, row.isLate ? 'Có' : 'Không', row.source]);
}

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function buildWorkbook(
  title: string,
  workbookHeaders: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number>>,
  widths: readonly number[],
  percentageColumn?: number,
): Promise<Buffer> {
  const workbook = await XlsxPopulate.fromBlankAsync();
  const sheet = workbook.sheet(0).name(title);
  sheet.cell('A1').value([workbookHeaders, ...rows]);
  sheet.row(1).style('bold', true);
  sheet.freezePanes(0, 1);
  widths.forEach((width, index) => sheet.column(index + 1).width(width));
  if (percentageColumn) sheet.column(percentageColumn).style('numberFormat', '0.0%');
  const output = await workbook.outputAsync();
  return output instanceof ArrayBuffer ? Buffer.from(new Uint8Array(output)) : Buffer.from(output);
}

export async function buildGradebookExport(format: 'CSV' | 'XLSX', rows: readonly GradebookExportRow[]): Promise<BuiltReportExport> {
  const body = values(rows);
  if (format === 'CSV') {
    const csv = [headers, ...body].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    return { bytes: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csv, 'utf8')]), mimeType: 'text/csv; charset=utf-8', extension: 'csv' };
  }
  return { bytes: await buildWorkbook('Sổ điểm', headers, body, [18, 26, 28, 10, 12, 12, 10, 12, 16], 6), mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' };
}

export async function buildProgressExport(format: 'CSV' | 'XLSX', rows: readonly ProgressExportRow[]): Promise<BuiltReportExport> {
  const progressHeaders = ['Mã học sinh', 'Họ tên học sinh', 'Hoàn thành (%)', 'Điểm trung bình (%)', 'Xu hướng', 'Cần hỗ trợ'];
  const body = rows.map((row) => [row.studentCode, row.studentName, row.completionPercent, row.averagePercent, row.trend, row.needsSupport ? 'Có' : 'Không']);
  if (format === 'CSV') {
    const csv = [progressHeaders, ...body].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    return { bytes: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csv, 'utf8')]), mimeType: 'text/csv; charset=utf-8', extension: 'csv' };
  }
  return { bytes: await buildWorkbook('Tiến độ', progressHeaders, body, [18, 26, 18, 22, 18, 16]), mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' };
}
