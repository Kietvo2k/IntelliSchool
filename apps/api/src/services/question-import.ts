import XlsxPopulate from 'xlsx-populate';
import type { UpdateQuestionInput } from '../repositories/platform.js';

export interface QuestionImportRow { row: number; input: UpdateQuestionInput; }
export interface QuestionImportError { row: number; field: string; message: string; }
export interface QuestionImportPreview { rows: QuestionImportRow[]; errors: QuestionImportError[]; canCommit: boolean; }

const maximumBytes = 5 * 1024 * 1024;
const maximumRows = 500;

function value(record: Record<string, unknown>, field: string): string {
  const raw = record[field] ?? record[field.toUpperCase()] ?? '';
  return String(raw).trim();
}

function rowError(errors: QuestionImportError[], row: number, field: string, message: string): void {
  errors.push({ row, field, message });
}

function parseCsv(bytes: Buffer): Record<string, unknown>[] {
  const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
  const cells: string[][] = [[]];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      cells[cells.length - 1]!.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      cells[cells.length - 1]!.push(value);
      value = '';
      cells.push([]);
    } else value += character;
  }
  cells[cells.length - 1]!.push(value);
  const headers = cells.shift()?.map((header) => header.trim()) ?? [];
  if (!headers.some(Boolean)) throw new Error('empty spreadsheet');
  return cells
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

async function parseXlsx(bytes: Buffer): Promise<Record<string, unknown>[]> {
  const workbook = await XlsxPopulate.fromDataAsync(bytes);
  const matrix = workbook.sheet(0).usedRange().value();
  const [headerRow, ...dataRows] = matrix;
  if (!headerRow?.some((header) => String(header ?? '').trim())) throw new Error('empty spreadsheet');
  const headers = headerRow.map((header) => String(header ?? '').trim());
  return dataRows
    .filter((row) => row.some((cell) => String(cell ?? '').trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

function maxScore(raw: string, row: number, errors: QuestionImportError[]): number | undefined {
  const score = Number(raw);
  if (!Number.isFinite(score) || score <= 0 || score > 1_000) {
    rowError(errors, row, 'max_score', 'Điểm tối đa phải là một số lớn hơn 0 và không quá 1000.');
    return undefined;
  }
  return score;
}

function normalizeType(raw: string): UpdateQuestionInput['type'] | undefined {
  const type = raw.trim().toUpperCase();
  return ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY'].includes(type) ? type as UpdateQuestionInput['type'] : undefined;
}

function parseTrueFalseFlags(raw: string): { a: boolean; b: boolean; c: boolean; d: boolean } | undefined {
  const parts = raw.split(/[|,;/]/).map((item) => item.trim().toLocaleLowerCase('vi-VN')).filter(Boolean);
  if (parts.length !== 4) return undefined;
  const flags = parts.map((part) => {
    if (part === 't' || part === 'true' || part === 'đúng' || part === 'dung' || part === '1') return true;
    if (part === 'f' || part === 'false' || part === 'sai' || part === '0') return false;
    return null;
  });
  if (flags.some((flag) => flag === null)) return undefined;
  return { a: flags[0]!, b: flags[1]!, c: flags[2]!, d: flags[3]! };
}

function parseRow(record: Record<string, unknown>, row: number, errors: QuestionImportError[]): UpdateQuestionInput | undefined {
  const type = normalizeType(value(record, 'type'));
  const prompt = value(record, 'prompt');
  const score = maxScore(value(record, 'max_score'), row, errors);
  if (!type) rowError(errors, row, 'type', 'Loại câu hỏi không hợp lệ.');
  if (!prompt || prompt.length > 10_000) rowError(errors, row, 'prompt', 'Nội dung câu hỏi là bắt buộc và không quá 10.000 ký tự.');
  if (!type || !prompt || !score) return undefined;
  if (type === 'MULTIPLE_CHOICE') {
    const choices = ['choice_a', 'choice_b', 'choice_c', 'choice_d'].map((field) => value(record, field)).filter(Boolean);
    const answer = value(record, 'correct_answer');
    if (choices.length < 2) rowError(errors, row, 'choice_a', 'Trắc nghiệm cần ít nhất hai lựa chọn.');
    if (new Set(choices.map((choice) => choice.toLocaleLowerCase('vi-VN'))).size !== choices.length) rowError(errors, row, 'choice_a', 'Các lựa chọn không được trùng nhau.');
    if (!choices.includes(answer)) rowError(errors, row, 'correct_answer', 'Đáp án đúng phải trùng với một lựa chọn.');
    return choices.length >= 2 && choices.includes(answer) ? { type, prompt: { text: prompt, choices }, answerKey: { choice: answer }, rubric: {}, maxScore: score } : undefined;
  }
  if (type === 'TRUE_FALSE') {
    const statements = ['choice_a', 'choice_b', 'choice_c', 'choice_d']
      .map((field, index) => ({ key: (['a', 'b', 'c', 'd'] as const)[index]!, text: value(record, field) }))
      .filter((item) => item.text);
    const flags = parseTrueFalseFlags(value(record, 'correct_answer'));
    if (statements.length !== 4) rowError(errors, row, 'choice_a', 'Đúng/sai cần đủ bốn ý ở choice_a–d.');
    if (!flags) rowError(errors, row, 'correct_answer', 'Đúng/sai nhận bốn cờ T|F|T|F (hoặc true,false,...).');
    return statements.length === 4 && flags
      ? { type, prompt: { text: prompt, statements }, answerKey: { values: flags }, rubric: {}, maxScore: score }
      : undefined;
  }
  if (type === 'SHORT_ANSWER') {
    const acceptable = value(record, 'acceptable_answers').split(/[|\n]/).map((item) => item.trim()).filter(Boolean);
    const numeric = value(record, 'correct_answer') || (acceptable.length === 1 ? acceptable[0]! : '');
    if (!acceptable.length && !numeric) rowError(errors, row, 'acceptable_answers', 'Câu trả lời ngắn cần đáp án số hoặc danh sách chấp nhận.');
    if (new Set(acceptable.map((item) => item.toLocaleLowerCase('vi-VN'))).size !== acceptable.length) rowError(errors, row, 'acceptable_answers', 'Đáp án chấp nhận không được trùng nhau.');
    if (!acceptable.length && !numeric) return undefined;
    const looksNumeric = /^-?\d+([.,]\d+)?$/.test(numeric.replaceAll(/\s+/g, ''));
    return {
      type,
      prompt: { text: prompt },
      answerKey: looksNumeric ? { numeric, acceptable: acceptable.length ? acceptable : undefined } : { acceptable },
      rubric: {},
      maxScore: score,
    };
  }
  const criteria = value(record, 'rubric').split(';').map((part) => {
    const [label, rawPoints, description] = part.split('|').map((item) => item.trim());
    return { label, maxScore: Number(rawPoints), ...(description ? { description } : {}) };
  }).filter((criterion) => criterion.label && Number.isFinite(criterion.maxScore) && criterion.maxScore > 0);
  if (!criteria.length) rowError(errors, row, 'rubric', 'Tự luận cần rubric theo mẫu Tiêu chí|Điểm|Mô tả;...');
  if (criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0) > score) rowError(errors, row, 'rubric', 'Tổng điểm rubric không được vượt quá điểm tối đa.');
  return criteria.length && criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0) <= score ? { type, prompt: { text: prompt }, answerKey: {}, rubric: { criteria }, maxScore: score } : undefined;
}

export async function parseQuestionImport(bytes: Buffer, filename: string): Promise<QuestionImportPreview> {
  const errors: QuestionImportError[] = [];
  if (!bytes.length) return { rows: [], errors: [{ row: 0, field: 'file', message: 'Tệp import không được để trống.' }], canCommit: false };
  if (bytes.length > maximumBytes) return { rows: [], errors: [{ row: 0, field: 'file', message: 'Tệp import không được vượt quá 5 MB.' }], canCommit: false };
  if (!/\.(csv|xlsx)$/i.test(filename)) return { rows: [], errors: [{ row: 0, field: 'file', message: 'Chỉ hỗ trợ tệp CSV hoặc XLSX.' }], canCommit: false };
  let records: Record<string, unknown>[];
  try {
    records = /\.csv$/i.test(filename) ? parseCsv(bytes) : await parseXlsx(bytes);
  } catch {
    return { rows: [], errors: [{ row: 0, field: 'file', message: 'Không thể đọc tệp CSV/XLSX.' }], canCommit: false };
  }
  if (!records.length) return { rows: [], errors: [{ row: 0, field: 'file', message: 'Tệp import chưa có dòng dữ liệu.' }], canCommit: false };
  if (records.length > maximumRows) return { rows: [], errors: [{ row: 0, field: 'file', message: 'Mỗi lần import tối đa 500 dòng.' }], canCommit: false };
  const rows: QuestionImportRow[] = [];
  records.forEach((record, index) => {
    const parsed = parseRow(record, index + 2, errors);
    if (parsed) rows.push({ row: index + 2, input: parsed });
  });
  return { rows, errors, canCommit: errors.length === 0 && rows.length > 0 };
}
