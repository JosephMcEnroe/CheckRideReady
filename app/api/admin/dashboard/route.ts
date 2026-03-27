import { auth } from "@/auth";
import { pool } from "@/lib/db";

export async function GET() {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [memberRows] = await pool.execute(
    `SELECT school_id FROM school_members WHERE user_id = ? AND role = 'admin' LIMIT 1`,
    [userId]
  );
  if ((memberRows as any[]).length === 0) {
    return Response.json({ error: "Not an admin" }, { status: 403 });
  }
  const schoolId = (memberRows as any[])[0].school_id;

  const [
    schoolRows,
    statsRows,
    instrRows,
    needsAttentionRows,
    recentRows,
    weakAreaRows,
    readinessRows,
  ] = await Promise.all([
    pool.execute(`SELECT name FROM schools WHERE id = ? LIMIT 1`, [schoolId]),
    pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM school_members WHERE school_id = ? AND role = 'student') as totalStudents,
         (SELECT COUNT(*) FROM school_members WHERE school_id = ? AND role = 'instructor') as totalInstructors,
         (SELECT COUNT(*) FROM oral_sessions os
          JOIN school_members sm ON sm.user_id = os.user_id AND sm.school_id = ?
          WHERE os.started_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as sessionsThisWeek,
         (SELECT ROUND(AVG(CASE sq.result
            WHEN 'PASS' THEN 100 WHEN 'PROBE' THEN 70
            WHEN 'REMEDIATE' THEN 40 WHEN 'FAIL' THEN 0
            ELSE NULL END))
          FROM session_questions sq
          JOIN oral_sessions os ON os.id = sq.session_id
          JOIN school_members sm ON sm.user_id = os.user_id AND sm.school_id = ?
         ) as avgScore`,
      [schoolId, schoolId, schoolId, schoolId]
    ),
    pool.execute(
      `SELECT
         u.id, u.name,
         COUNT(DISTINCT ist.student_id) as student_count,
         ROUND(AVG(CASE sq.result
           WHEN 'PASS' THEN 100 WHEN 'PROBE' THEN 70
           WHEN 'REMEDIATE' THEN 40 WHEN 'FAIL' THEN 0
           ELSE NULL END)) as avg_score
       FROM school_members sm
       JOIN users u ON u.id = sm.user_id
       LEFT JOIN instructor_students ist ON ist.instructor_id = u.id
       LEFT JOIN oral_sessions os ON os.user_id = ist.student_id
       LEFT JOIN session_questions sq ON sq.session_id = os.id
       WHERE sm.school_id = ? AND sm.role = 'instructor'
       GROUP BY u.id, u.name
       ORDER BY student_count DESC`,
      [schoolId]
    ),
    pool.execute(
      `SELECT DISTINCT
         u.id, u.name,
         os.overall_grade as last_result,
         inst.name as instructor_name
       FROM school_members sm
       JOIN users u ON u.id = sm.user_id
       JOIN oral_sessions os ON os.user_id = u.id
       LEFT JOIN instructor_students ist ON ist.student_id = u.id
       LEFT JOIN users inst ON inst.id = ist.instructor_id
       WHERE sm.school_id = ? AND sm.role = 'student'
       AND os.overall_grade IN ('FAIL', 'REMEDIATE')
       AND os.id = (
         SELECT id FROM oral_sessions
         WHERE user_id = u.id
         ORDER BY started_at DESC LIMIT 1
       )
       LIMIT 5`,
      [schoolId]
    ),
    pool.execute(
      `SELECT
         os.id, os.mode, os.overall_grade, os.started_at,
         u.name as student_name,
         ROUND(AVG(CASE sq.result
           WHEN 'PASS' THEN 100 WHEN 'PROBE' THEN 70
           WHEN 'REMEDIATE' THEN 40 WHEN 'FAIL' THEN 0
           ELSE NULL END)) as score
       FROM oral_sessions os
       JOIN users u ON u.id = os.user_id
       JOIN school_members sm ON sm.user_id = os.user_id AND sm.school_id = ?
       LEFT JOIN session_questions sq ON sq.session_id = os.id AND sq.result IS NOT NULL
       WHERE os.overall_grade IS NOT NULL
       GROUP BY os.id, os.mode, os.overall_grade, os.started_at, u.name
       ORDER BY os.started_at DESC
       LIMIT 8`,
      [schoolId]
    ),
    pool.execute(
      `SELECT
         sq.acs_task as code,
         ROUND(SUM(CASE WHEN sq.result IN ('FAIL','REMEDIATE') THEN 1 ELSE 0 END)
           * 100.0 / COUNT(*)) as failure_rate
       FROM session_questions sq
       JOIN oral_sessions os ON os.id = sq.session_id
       JOIN school_members sm ON sm.user_id = os.user_id AND sm.school_id = ?
       WHERE sq.result IS NOT NULL AND sq.acs_task IS NOT NULL
       GROUP BY sq.acs_task
       ORDER BY failure_rate DESC
       LIMIT 3`,
      [schoolId]
    ),
    pool.execute(
      `SELECT
         SUM(CASE WHEN avg_m >= 4 THEN 1 ELSE 0 END) as ready,
         SUM(CASE WHEN avg_m >= 2.5 AND avg_m < 4 THEN 1 ELSE 0 END) as developing,
         SUM(CASE WHEN avg_m < 2.5 THEN 1 ELSE 0 END) as needsWork
       FROM (
         SELECT us.user_id, AVG(us.mastery) as avg_m
         FROM user_skill us
         JOIN school_members sm ON sm.user_id = us.user_id AND sm.school_id = ?
         WHERE sm.role = 'student'
         GROUP BY us.user_id
       ) t`,
      [schoolId]
    ),
  ]);

  const schoolName = (schoolRows[0] as any[])[0]?.name ?? "";
  const sr = (statsRows[0] as any[])[0] ?? {};
  const rdRow = (readinessRows[0] as any[])[0] ?? {};

  return Response.json({
    schoolName,
    stats: {
      totalStudents: Number(sr.totalStudents) || 0,
      totalInstructors: Number(sr.totalInstructors) || 0,
      sessionsThisWeek: Number(sr.sessionsThisWeek) || 0,
      avgScore: sr.avgScore !== null ? Number(sr.avgScore) : null,
    },
    instructors: (instrRows[0] as any[]).map((i) => ({
      id: i.id,
      name: i.name,
      student_count: Number(i.student_count) || 0,
      avg_score: i.avg_score !== null ? Number(i.avg_score) : null,
    })),
    needsAttention: needsAttentionRows[0] as any[],
    recentActivity: (recentRows[0] as any[]).map((r) => ({
      id: r.id,
      mode: r.mode,
      overall_grade: r.overall_grade,
      started_at: r.started_at,
      student_name: r.student_name,
      score: r.score !== null ? Number(r.score) : null,
    })),
    weakAreas: (weakAreaRows[0] as any[]).map((w) => ({
      code: w.code,
      failure_rate: Number(w.failure_rate) || 0,
    })),
    readiness: {
      ready: Number(rdRow.ready) || 0,
      developing: Number(rdRow.developing) || 0,
      needsWork: Number(rdRow.needsWork) || 0,
    },
  });
}
