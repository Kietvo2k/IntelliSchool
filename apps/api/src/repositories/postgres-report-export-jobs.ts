import type pg from 'pg';
import type { ClaimedReportExport } from '../services/report-export-worker.js';
import type { GradebookExportRow, ProgressExportRow } from '../services/report-export.js';

export class PostgresReportExportJobRepository {
  constructor(private readonly pool: pg.Pool) {}

  async claimNext(): Promise<ClaimedReportExport | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{ id: string; school_id: string; kind: 'GRADEBOOK' | 'PROGRESS'; format: 'CSV' | 'XLSX'; filters: unknown }>(`
        WITH next_job AS (
          SELECT id FROM report_exports WHERE status = 'QUEUED' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
        )
        UPDATE report_exports r SET status = 'PROCESSING' FROM next_job
        WHERE r.id = next_job.id RETURNING r.id, r.school_id, r.kind, r.format, r.filters
      `);
      await client.query('COMMIT');
      const row = result.rows[0];
      if (!row) return null;
      const filters = (row.filters ?? {}) as Record<string, unknown>;
      if (typeof filters.classId !== 'string') throw new Error('Report export job không có classId hợp lệ.');
      return { id: row.id, schoolId: row.school_id, kind: row.kind, format: row.format, filters: { classId: filters.classId, subjectId: typeof filters.subjectId === 'string' ? filters.subjectId : null, studentId: typeof filters.studentId === 'string' ? filters.studentId : null } };
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; } finally { client.release(); }
  }

  async markReady(exportId: string, objectKey: string): Promise<void> {
    await this.pool.query(`UPDATE report_exports SET status = 'READY', object_key = $2, completed_at = now(), error_message = NULL WHERE id = $1`, [exportId, objectKey]);
  }

  async markFailed(exportId: string, message: string): Promise<void> {
    await this.pool.query(`UPDATE report_exports SET status = 'FAILED', error_message = $2, completed_at = now() WHERE id = $1`, [exportId, message.slice(0, 2_000)]);
  }

  async listGradebook(job: ClaimedReportExport): Promise<GradebookExportRow[]> {
    const filters = job.filters;
    const params: unknown[] = [job.schoolId, filters.classId];
    const conditions = ['ge.school_id = $1', 'ge.class_id = $2'];
    if (filters.subjectId) { params.push(filters.subjectId); conditions.push(`ge.subject_id = $${params.length}`); }
    if (filters.studentId) { params.push(filters.studentId); conditions.push(`ge.student_id = $${params.length}`); }
    const result = await this.pool.query<{ student_code: string; student_name: string; assignment_title: string | null; score: string; max_score: string; source: string; attempt_count: string; is_late: boolean }>(`
      SELECT sp.student_code, u.display_name AS student_name, a.title AS assignment_title, ge.score::text, ge.max_score::text, ge.source,
        (SELECT count(*)::text FROM assignment_attempts aa WHERE aa.assignment_id = ge.assignment_id AND aa.student_id = ge.student_id) AS attempt_count,
        EXISTS (SELECT 1 FROM assignment_attempts aa WHERE aa.assignment_id = ge.assignment_id AND aa.student_id = ge.student_id AND aa.is_late) AS is_late
      FROM gradebook_entries ge JOIN users u ON u.id = ge.student_id JOIN student_profiles sp ON sp.user_id = ge.student_id
      LEFT JOIN assignments a ON a.id = ge.assignment_id
      WHERE ${conditions.join(' AND ')} ORDER BY u.display_name, a.title
    `, params);
    return result.rows.map((row) => ({ studentCode: row.student_code, studentName: row.student_name, assignmentTitle: row.assignment_title ?? 'Điểm tổng hợp', score: Number(row.score), maxScore: Number(row.max_score), attemptCount: Number(row.attempt_count), isLate: row.is_late, source: row.source }));
  }

  async listProgress(job: ClaimedReportExport): Promise<ProgressExportRow[]> {
    const { classId, subjectId, studentId } = job.filters;
    const result = await this.pool.query<{ student_code: string; student_name: string; assignment_count: string; submitted_count: string; lesson_count: string; completed_lessons: string; average_ratio: string | null }>(`
      SELECT sp.student_code, u.display_name AS student_name,
        (SELECT count(*)::text FROM assignments a WHERE a.school_id = $1 AND a.class_id = $2 AND a.status = 'PUBLISHED' AND ($3::uuid IS NULL OR a.subject_id = $3)) AS assignment_count,
        (SELECT count(*)::text FROM assignment_attempts aa JOIN assignments a ON a.id = aa.assignment_id WHERE aa.student_id = ce.student_id AND a.school_id = $1 AND a.class_id = $2 AND a.status = 'PUBLISHED' AND ($3::uuid IS NULL OR a.subject_id = $3) AND aa.status IN ('SUBMITTED','GRADED','RETURNED')) AS submitted_count,
        (SELECT count(*)::text FROM lessons l WHERE l.school_id = $1 AND l.class_id = $2 AND l.published_at IS NOT NULL AND l.archived_at IS NULL AND ($3::uuid IS NULL OR l.subject_id = $3)) AS lesson_count,
        (SELECT count(*)::text FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id WHERE lp.student_id = ce.student_id AND lp.status = 'COMPLETED' AND l.school_id = $1 AND l.class_id = $2 AND l.published_at IS NOT NULL AND l.archived_at IS NULL AND ($3::uuid IS NULL OR l.subject_id = $3)) AS completed_lessons,
        (SELECT avg(ge.score / NULLIF(ge.max_score, 0))::text FROM gradebook_entries ge WHERE ge.student_id = ce.student_id AND ge.school_id = $1 AND ge.class_id = $2 AND ($3::uuid IS NULL OR ge.subject_id = $3)) AS average_ratio
      FROM class_enrollments ce JOIN users u ON u.id = ce.student_id JOIN student_profiles sp ON sp.user_id = ce.student_id
      WHERE ce.school_id = $1 AND ce.class_id = $2 AND ce.status = 'ACTIVE' AND ($4::uuid IS NULL OR ce.student_id = $4) ORDER BY u.display_name
    `, [job.schoolId, classId, subjectId ?? null, studentId ?? null]);
    return result.rows.map((row) => {
      const assigned = Number(row.assignment_count); const submitted = Number(row.submitted_count); const lessons = Number(row.lesson_count); const completed = Number(row.completed_lessons);
      const total = assigned + lessons; const completionPercent = total ? Math.round((submitted + completed) / total * 100) : 0; const averagePercent = Math.round(Number(row.average_ratio ?? 0) * 100);
      return { studentCode: row.student_code, studentName: row.student_name, completionPercent, averagePercent, trend: 'NO_DATA', needsSupport: total > 0 && (completionPercent < 60 || averagePercent < 50) };
    });
  }
}
