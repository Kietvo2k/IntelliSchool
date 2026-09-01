import pg from 'pg';

if (process.env.NODE_ENV === 'production') throw new Error('Không được reset kỳ thi pilot trên production.');
if (process.env.PILOT_EXAM_RESET_CONFIRM !== 'RESET_PILOT_EXAMS') {
  throw new Error('Cần đặt PILOT_EXAM_RESET_CONFIRM=RESET_PILOT_EXAMS để chỉ reset dữ liệu ca thi pilot.');
}

const connectionString = process.env.PLATFORM_CONTROL_DATABASE_URL
  ?? process.env.SMARTPATH_TEST_CONTROL_DATABASE_URL
  ?? process.env.API_DATABASE_URL
  ?? 'postgres://smartpath_control:smartpath_control_local_only@127.0.0.1:5433/smartclass';
const pilotExamTitles = [
  'Thi thử Toán trường',
  'Thi thử Ngữ văn trường',
  'Thi thử Vật lí trường',
  'Thi thử Hóa học trường',
  'Thi thử Tiếng Anh trường',
];
const pool = new pg.Pool({ connectionString });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const examIds = await client.query<{ id: string }>(`
    SELECT a.id
    FROM assignments a
    JOIN schools s ON s.id = a.school_id
    WHERE s.code = 'SP-PILOT001'
      AND a.delivery_mode = 'EXAM'
      AND a.title = ANY($1::text[])
  `, [pilotExamTitles]);
  const ids = examIds.rows.map((row) => row.id);
  if (ids.length > 0) {
    await client.query('DELETE FROM exam_integrity_events WHERE session_id IN (SELECT id FROM exam_sessions WHERE assignment_id = ANY($1::uuid[]))', [ids]);
    await client.query('DELETE FROM exam_sessions WHERE assignment_id = ANY($1::uuid[])', [ids]);
    await client.query('DELETE FROM gradebook_entries WHERE assignment_id = ANY($1::uuid[])', [ids]);
    await client.query('DELETE FROM assignment_attempts WHERE assignment_id = ANY($1::uuid[])', [ids]);
  }
  await client.query('COMMIT');
  console.log(`Đã reset ${ids.length} ca thi pilot; không xóa bài tập hay ngân hàng câu hỏi.`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
