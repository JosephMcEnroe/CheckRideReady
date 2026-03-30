import { pool } from "@/lib/db";
import { auth } from "@/auth";
import { getInstructorSchoolId } from "@/lib/instructor-auth";

export async function GET() {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const schoolId = await getInstructorSchoolId(userId);
  if (!schoolId) return Response.json({ error: "Not an instructor" }, { status: 403 });

  const [studentRows] = await pool.execute(
    `SELECT
       u.id,
       u.name,
       u.email,
       u.certificate_goal,
       ist.assigned_at,
       latest.last_session_date,
       latest.last_result,
       latest.last_score,
       latest.session_count
     FROM instructor_students ist
     JOIN users u ON u.id = ist.student_id
     LEFT JOIN (
       SELECT
         user_id,
         MAX(started_at) as last_session_date,
         COUNT(*) as session_count,
         (SELECT overall_grade FROM oral_sessions WHERE user_id = os2.user_id ORDER BY started_at DESC LIMIT 1) as last_result,
         (SELECT ROUND(AVG(CASE result WHEN 'PASS' THEN 100 WHEN 'PROBE' THEN 70 WHEN 'REMEDIATE' THEN 40 WHEN 'FAIL' THEN 0 END))
          FROM session_questions sq
          JOIN oral_sessions os3 ON os3.id = sq.session_id
          WHERE os3.user_id = os2.user_id
            AND os3.id = (SELECT id FROM oral_sessions WHERE user_id = os2.user_id ORDER BY started_at DESC LIMIT 1)
         ) as last_score
       FROM oral_sessions os2
       GROUP BY user_id
     ) latest ON latest.user_id = u.id
     WHERE ist.instructor_id = ?
     ORDER BY latest.last_session_date DESC`,
    [userId]
  );

  const students = studentRows as any[];

  if (students.length === 0) {
    return Response.json({ students: [] });
  }

  // Single query for all students' weakest ACS areas — avoids N+1
  const studentIds = students.map((s) => s.id);
  const [weakestRows] = await pool.execute(
    `SELECT us1.user_id, us1.acs_task_code
     FROM user_skill us1
     WHERE us1.user_id IN (${studentIds.map(() => "?").join(",")})
       AND us1.mastery = (
         SELECT MIN(us2.mastery) FROM user_skill us2 WHERE us2.user_id = us1.user_id
       )`,
    studentIds
  );
  const weakestMap = new Map(
    (weakestRows as any[]).map((r) => [r.user_id, r.acs_task_code])
  );

  const enriched = students.map((s) => ({
    ...s,
    weakest_area: weakestMap.get(s.id) ?? null,
  }));

  return Response.json({ students: enriched });
}
