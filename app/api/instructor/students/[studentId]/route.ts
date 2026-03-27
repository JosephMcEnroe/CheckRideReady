import { pool } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId } = await params;

  // Verify caller is assigned instructor OR admin in the same school
  const [assignRows] = await pool.execute(
    `SELECT id FROM instructor_students WHERE instructor_id = ? AND student_id = ? LIMIT 1`,
    [userId, studentId]
  );
  const isInstructor = (assignRows as any[]).length > 0;

  if (!isInstructor) {
    const [adminRows] = await pool.execute(
      `SELECT sm1.id FROM school_members sm1
       JOIN school_members sm2 ON sm2.school_id = sm1.school_id
       WHERE sm1.user_id = ? AND sm1.role = 'admin' AND sm2.user_id = ?
       LIMIT 1`,
      [userId, studentId]
    );
    if ((adminRows as any[]).length === 0) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const [studentRows] = await pool.execute(
    `SELECT id, name, email, certificate_goal FROM users WHERE id = ? LIMIT 1`,
    [studentId]
  );
  const student = (studentRows as any[])[0];
  if (!student) return Response.json({ error: "Student not found" }, { status: 404 });

  const sessionSql = `
    SELECT id, mode, status, overall_grade, started_at, ended_at,
      ROUND((
        SELECT AVG(CASE result WHEN 'PASS' THEN 100 WHEN 'PROBE' THEN 70 WHEN 'REMEDIATE' THEN 40 WHEN 'FAIL' THEN 0 END)
        FROM session_questions
        WHERE session_id = os.id AND result IS NOT NULL
      )) as score
    FROM oral_sessions os
    WHERE user_id = ?
    ORDER BY started_at DESC
    LIMIT 20`;

  const [sessionRows] = await pool.execute(sessionSql, [studentId]);
  const sessions = sessionRows as any[];

  const [acsRows] = await pool.execute(
    `SELECT acs_task_code, mastery, attempts, passes, fails FROM user_skill WHERE user_id = ? ORDER BY mastery ASC`,
    [studentId]
  );

  // Score trend: last 10 sessions reversed (oldest first) for chart
  const [trendRows] = await pool.execute(
    `SELECT id, started_at,
      ROUND((
        SELECT AVG(CASE result WHEN 'PASS' THEN 100 WHEN 'PROBE' THEN 70 WHEN 'REMEDIATE' THEN 40 WHEN 'FAIL' THEN 0 END)
        FROM session_questions WHERE session_id = os.id AND result IS NOT NULL
      )) as score
     FROM oral_sessions os
     WHERE user_id = ?
     ORDER BY started_at DESC
     LIMIT 10`,
    [studentId]
  );
  const scoreTrend = (trendRows as any[]).reverse();

  const [noteRows] = await pool.execute(
    `SELECT cn.id, cn.note_text, cn.created_at
     FROM cfi_notes cn
     WHERE cn.student_id = ?
       AND (cn.instructor_id = ? OR EXISTS (
         SELECT 1 FROM school_members WHERE user_id = ? AND role = 'admin'
       ))
     ORDER BY cn.created_at DESC`,
    [studentId, userId, userId]
  );

  return Response.json({
    student,
    sessions,
    acsAreas: acsRows,
    scoreTrend,
    notes: noteRows,
  });
}
