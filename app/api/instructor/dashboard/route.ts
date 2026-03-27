import { auth } from "@/auth";
import { pool } from "@/lib/db";

export async function GET() {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [memberRows] = await pool.execute(
    `SELECT school_id FROM school_members WHERE user_id = ? AND role = 'instructor' LIMIT 1`,
    [userId]
  );
  if ((memberRows as any[]).length === 0) {
    return Response.json({ error: "Not an instructor" }, { status: 403 });
  }

  const [statsRows, studentRows, weekRows, atRiskRows, passRateRows] = await Promise.all([
    pool.execute(
      `SELECT COUNT(*) as total FROM instructor_students WHERE instructor_id = ?`,
      [userId]
    ),
    pool.execute(
      `SELECT
         u.id, u.name, u.email, u.certificate_goal,
         latest.last_session_date, latest.last_result,
         latest.last_score, latest.session_count,
         skill.avg_mastery
       FROM instructor_students ist
       JOIN users u ON u.id = ist.student_id
       LEFT JOIN (
         SELECT
           user_id,
           MAX(started_at) as last_session_date,
           COUNT(*) as session_count,
           (SELECT overall_grade FROM oral_sessions
            WHERE user_id = os2.user_id
            ORDER BY started_at DESC LIMIT 1) as last_result,
           (SELECT ROUND(AVG(CASE result
              WHEN 'PASS' THEN 100 WHEN 'PROBE' THEN 70
              WHEN 'REMEDIATE' THEN 40 WHEN 'FAIL' THEN 0
              ELSE NULL END))
            FROM session_questions sq
            JOIN oral_sessions os3 ON os3.id = sq.session_id
            WHERE os3.user_id = os2.user_id
            AND os3.id = (SELECT id FROM oral_sessions
                          WHERE user_id = os2.user_id
                          ORDER BY started_at DESC LIMIT 1)
           ) as last_score
         FROM oral_sessions os2
         GROUP BY user_id
       ) latest ON latest.user_id = u.id
       LEFT JOIN (
         SELECT user_id, ROUND(AVG(mastery / 5 * 100)) as avg_mastery
         FROM user_skill
         GROUP BY user_id
       ) skill ON skill.user_id = u.id
       WHERE ist.instructor_id = ?
       ORDER BY
         CASE WHEN latest.last_result IN ('FAIL', 'REMEDIATE') THEN 0 ELSE 1 END,
         latest.last_session_date DESC
       LIMIT 5`,
      [userId]
    ),
    pool.execute(
      `SELECT COUNT(*) as count
       FROM oral_sessions os
       JOIN instructor_students ist ON ist.student_id = os.user_id
       WHERE ist.instructor_id = ?
       AND os.started_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [userId]
    ),
    pool.execute(
      `SELECT COUNT(DISTINCT os.user_id) as count
       FROM oral_sessions os
       JOIN instructor_students ist ON ist.student_id = os.user_id
       WHERE ist.instructor_id = ?
       AND os.overall_grade IN ('FAIL', 'REMEDIATE')
       AND os.id = (
         SELECT id FROM oral_sessions
         WHERE user_id = os.user_id
         ORDER BY started_at DESC LIMIT 1
       )`,
      [userId]
    ),
    pool.execute(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN os.overall_grade = 'PASS' THEN 1 ELSE 0 END) as passes
       FROM oral_sessions os
       JOIN instructor_students ist ON ist.student_id = os.user_id
       WHERE ist.instructor_id = ? AND os.overall_grade IS NOT NULL`,
      [userId]
    ),
  ]);

  const totalStudents = Number((statsRows[0] as any[])[0]?.total) || 0;
  const sessionsThisWeek = Number((weekRows[0] as any[])[0]?.count) || 0;
  const atRiskStudents = Number((atRiskRows[0] as any[])[0]?.count) || 0;
  const prRow = (passRateRows[0] as any[])[0];
  const passRate =
    prRow?.total > 0 ? Math.round((Number(prRow.passes) / Number(prRow.total)) * 100) : 0;

  const students = studentRows[0] as any[];

  // Weakest area per student
  const studentIds = students.map((s) => s.id);
  let weakestMap = new Map<string, string>();
  if (studentIds.length > 0) {
    const [weakestRows] = await pool.execute(
      `SELECT us1.user_id, us1.acs_task_code
       FROM user_skill us1
       WHERE us1.user_id IN (${studentIds.map(() => "?").join(",")})
         AND us1.mastery = (
           SELECT MIN(us2.mastery) FROM user_skill us2 WHERE us2.user_id = us1.user_id
         )`,
      studentIds
    );
    weakestMap = new Map((weakestRows as any[]).map((r) => [r.user_id, r.acs_task_code]));
  }

  const enriched = students.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    certificate_goal: s.certificate_goal,
    last_session_date: s.last_session_date,
    last_result: s.last_result,
    last_score: s.last_score,
    session_count: s.session_count,
    readiness: s.avg_mastery !== null ? Number(s.avg_mastery) : null,
    weakest_area: weakestMap.get(s.id) ?? null,
    status:
      s.last_result === "FAIL" || s.last_result === "REMEDIATE"
        ? "needs-review"
        : "on-track",
  }));

  return Response.json({
    stats: { totalStudents, sessionsThisWeek, atRiskStudents, passRate },
    students: enriched,
  });
}
