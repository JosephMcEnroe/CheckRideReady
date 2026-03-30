import { pool } from "@/lib/db";
import { auth } from "@/auth";
import { getInstructorSchoolId } from "@/lib/instructor-auth";

export async function GET() {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const schoolId = await getInstructorSchoolId(userId);
  if (!schoolId) return Response.json({ error: "Not an instructor" }, { status: 403 });

  const [[totalRow], [weekRow], [atRiskRow]] = await Promise.all([
    pool.execute(
      `SELECT COUNT(*) as total FROM instructor_students WHERE instructor_id = ?`,
      [userId]
    ),
    pool.execute(
      `SELECT COUNT(*) as count FROM oral_sessions os
       JOIN instructor_students ist ON ist.student_id = os.user_id
       WHERE ist.instructor_id = ?
         AND os.started_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [userId]
    ),
    pool.execute(
      `SELECT COUNT(DISTINCT ist.student_id) as count
       FROM instructor_students ist
       JOIN oral_sessions os ON os.user_id = ist.student_id
       WHERE ist.instructor_id = ?
         AND os.overall_grade IN ('FAIL', 'REMEDIATE')
         AND os.id = (SELECT id FROM oral_sessions WHERE user_id = ist.student_id ORDER BY started_at DESC LIMIT 1)`,
      [userId]
    ),
  ]) as any[];

  // Pass rate: across all latest sessions
  const [passRows] = await pool.execute(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN os.overall_grade = 'PASS' THEN 1 ELSE 0 END) as passes
     FROM instructor_students ist
     JOIN oral_sessions os ON os.user_id = ist.student_id
     WHERE ist.instructor_id = ?
       AND os.id = (SELECT id FROM oral_sessions WHERE user_id = ist.student_id ORDER BY started_at DESC LIMIT 1)`,
    [userId]
  ) as any[];

  const passData = (passRows as any[])[0] || {};
  const passRate =
    Number(passData.total) > 0
      ? Math.round((Number(passData.passes) / Number(passData.total)) * 100)
      : 0;

  return Response.json({
    totalStudents: Number((totalRow as any[])[0]?.total || 0),
    sessionsThisWeek: Number((weekRow as any[])[0]?.count || 0),
    atRiskStudents: Number((atRiskRow as any[])[0]?.count || 0),
    passRate,
  });
}
