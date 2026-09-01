import { describe, expect, it } from 'vitest';
import XlsxPopulate from 'xlsx-populate';
import { parseQuestionImport } from '../src/services/question-import.js';

describe('parseQuestionImport', () => {
  it('parses the supported CSV template into typed question input rows', async () => {
    const csv = [
      'type,prompt,choice_a,choice_b,choice_c,choice_d,correct_answer,acceptable_answers,rubric,max_score',
      'MULTIPLE_CHOICE,Đạo hàm của x²?,x,2x,x²,,2x,,,1',
      'TRUE_FALSE,Cho các ý sau,2 là số chẵn,3 là số chẵn,5 là số nguyên tố,9 là số nguyên tố,T|F|T|F,,,1',
      'SHORT_ANSWER,Nêu thủ đô Việt Nam,,,,,,Hà Nội|Ha Noi,,2',
      'ESSAY,Trình bày lời giải,,,,,,,Lập luận|2|Có lập luận;Trình bày|1|Rõ ràng,3',
    ].join('\n');

    const result = await parseQuestionImport(Buffer.from(csv), 'questions.csv');

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(4);
    expect(result.rows[0]?.input).toMatchObject({ type: 'MULTIPLE_CHOICE', answerKey: { choice: '2x' } });
    expect(result.rows[1]?.input).toMatchObject({ type: 'TRUE_FALSE', answerKey: { values: { a: true, b: false, c: true, d: false } } });
    expect(result.rows[2]?.input).toMatchObject({ type: 'SHORT_ANSWER', answerKey: { acceptable: ['Hà Nội', 'Ha Noi'] } });
    expect(result.rows[3]?.input).toMatchObject({ type: 'ESSAY', rubric: { criteria: [{ label: 'Lập luận', maxScore: 2 }, { label: 'Trình bày', maxScore: 1 }] } });
  });

  it('reports spreadsheet row errors and leaves imports atomic when any row is invalid', async () => {
    const csv = [
      'type,prompt,choice_a,choice_b,correct_answer,max_score',
      'MULTIPLE_CHOICE,Câu hợp lệ,A,B,A,1',
      'MULTIPLE_CHOICE,Câu sai,A,B,C,1',
    ].join('\n');

    const result = await parseQuestionImport(Buffer.from(csv), 'questions.csv');

    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual([expect.objectContaining({ row: 3, field: 'correct_answer' })]);
    expect(result.canCommit).toBe(false);
  });

  it('parses an XLSX template without depending on the legacy xlsx package', async () => {
    const workbook = await XlsxPopulate.fromBlankAsync();
    workbook.sheet(0).cell('A1').value([
      ['type', 'prompt', 'choice_a', 'choice_b', 'correct_answer', 'max_score'],
      ['MULTIPLE_CHOICE', 'Chọn đáp án đúng', 'A', 'B', 'A', 1],
    ]);

    const result = await parseQuestionImport(Buffer.from(await workbook.outputAsync()), 'questions.xlsx');

    expect(result).toMatchObject({ canCommit: true, errors: [] });
    expect(result.rows[0]?.input).toMatchObject({ type: 'MULTIPLE_CHOICE', answerKey: { choice: 'A' } });
  });
});
