export type ClassroomRole = 'PLATFORM_ADMIN' | 'SCHOOL_OWNER' | 'TEACHER' | 'STUDENT';

export interface ClassroomActor {
  userId: string;
  role: ClassroomRole;
  schoolId?: string;
}

export interface TeacherClassAssignment {
  classId: string;
  teacherId: string;
  subjectId: string | null;
  role: 'SUBJECT_TEACHER' | 'HOMEROOM_TEACHER';
}

export interface ClassSubjectScope {
  schoolId: string;
  classId: string;
  subjectId: string;
}

export interface StudentProgressScope extends ClassSubjectScope {
  studentId: string;
}

function isSameSchool(actor: ClassroomActor, scope: { schoolId: string }): boolean {
  return actor.role === 'PLATFORM_ADMIN' || actor.schoolId === scope.schoolId;
}

function isTeacherAssigned(actor: ClassroomActor, scope: ClassSubjectScope, assignments: readonly TeacherClassAssignment[]): boolean {
  return assignments.some((assignment) =>
    assignment.teacherId === actor.userId &&
    assignment.classId === scope.classId &&
    (assignment.role === 'HOMEROOM_TEACHER' || assignment.subjectId === scope.subjectId),
  );
}

/** Authorization is intentionally evaluated before a tenant-scoped repository is called. */
export function canAccessClassSubject(actor: ClassroomActor, scope: ClassSubjectScope, assignments: readonly TeacherClassAssignment[]): boolean {
  if (!isSameSchool(actor, scope)) return false;
  if (actor.role === 'PLATFORM_ADMIN' || actor.role === 'SCHOOL_OWNER') return true;
  return actor.role === 'TEACHER' && isTeacherAssigned(actor, scope, assignments);
}

export function canReadStudentProgress(
  actor: ClassroomActor,
  scope: StudentProgressScope,
  assignments: readonly TeacherClassAssignment[],
  enrolledStudentIds: readonly string[],
): boolean {
  if (!isSameSchool(actor, scope) || !enrolledStudentIds.includes(scope.studentId)) return false;
  if (actor.role === 'STUDENT') return actor.userId === scope.studentId;
  return canAccessClassSubject(actor, scope, assignments);
}
