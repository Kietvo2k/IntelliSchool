import { describe, expect, it } from 'vitest';
import { buildLearnerKbText, classroomGradesFromEntries, draftSkillsFromGrades, mapLmsSubjectToCareer, mergeClassroomGrades } from '../../src/domain/ai/learner-kb.js';

describe('learner knowledge base snapshot', () => {
  it('maps LMS subject codes onto career grade keys and omits empty PII', () => {
    expect(mapLmsSubjectToCareer('MATH')).toBe('TOAN');
    const text = buildLearnerKbText({
      displayName: 'Nguyễn Minh An',
      classroomGrades: { TOAN: 8.5 },
      riasec: { code: 'IRA' },
    });
    expect(text).toContain('TOAN');
    expect(text).toContain('IRA');
    expect(text).not.toContain('password');
  });

  it('averages gradebook rows onto 10-point career keys and fills snapshot blanks', () => {
    const fromBook = classroomGradesFromEntries([
      { subjectCode: 'MATH', score: 8, maxScore: 10 },
      { subjectCode: 'MATH', score: 6, maxScore: 10 },
    ]);
    expect(fromBook.TOAN).toBe(7);
    expect(mergeClassroomGrades(fromBook, { VAN: 9, TOAN: 10 })).toEqual({ VAN: 9, TOAN: 7 });
  });

  it('drafts remediation skills only for weak classroom grades', () => {
    const drafts = draftSkillsFromGrades({ TOAN: 5, VAN: 8 });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.skillCode).toBe('REMEDIATE_TOAN');
  });
});
