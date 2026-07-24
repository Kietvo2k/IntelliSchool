import { describe, expect, it } from 'vitest';
import { canAccessClassSubject, canReadStudentProgress } from '../../src/domain/classroom/access.js';

const schoolId = 'school-a';
const classId = 'class-a';
const subjectId = 'math';

describe('school classroom authorization policy', () => {
  it('limits subject teachers to their assigned class and subject while homeroom teachers can see class-wide progress', () => {
    const subjectTeacher = { userId: 'teacher-math', role: 'TEACHER' as const, schoolId };
    const homeroomTeacher = { userId: 'teacher-home', role: 'TEACHER' as const, schoolId };
    const assignments = [
      { classId, teacherId: 'teacher-math', subjectId, role: 'SUBJECT_TEACHER' as const },
      { classId, teacherId: 'teacher-home', subjectId: null, role: 'HOMEROOM_TEACHER' as const },
    ];

    expect(canAccessClassSubject(subjectTeacher, { schoolId, classId, subjectId }, assignments)).toBe(true);
    expect(canAccessClassSubject(subjectTeacher, { schoolId, classId, subjectId: 'physics' }, assignments)).toBe(false);
    expect(canReadStudentProgress(homeroomTeacher, { schoolId, classId, studentId: 'student-1', subjectId: 'literature' }, assignments, ['student-1'])).toBe(true);
  });

  it('does not let a student read another learner or a user from another school', () => {
    const student = { userId: 'student-1', role: 'STUDENT' as const, schoolId };
    const assignments: never[] = [];
    expect(canReadStudentProgress(student, { schoolId, classId, studentId: 'student-1', subjectId }, assignments, ['student-1'])).toBe(true);
    expect(canReadStudentProgress(student, { schoolId, classId, studentId: 'student-2', subjectId }, assignments, ['student-1', 'student-2'])).toBe(false);
    expect(canReadStudentProgress(student, { schoolId: 'school-b', classId, studentId: 'student-1', subjectId }, assignments, ['student-1'])).toBe(false);
  });
});
