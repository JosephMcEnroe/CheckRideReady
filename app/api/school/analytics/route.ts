import { pool } from "@/lib/db";
import { auth } from "@/auth";

type Range = "month" | "3months" | "all";

function getDateFilter(range: Range): string {
  if (range === "3months") return "AND os.started_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)";
  if (range === "month") return "AND os.started_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
  return "";
}

export async function GET(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [adminRows] = await pool.execute(
    `SELECT school_id FROM school_members WHERE user_id = ? AND role = 'admin' LIMIT 1`,
    [userId]
  );
  const schoolId = (adminRows as any[])[0]?.school_id;
  if (!schoolId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const rangeParam = searchParams.get("range") || "month";
  const range: Range = (["month", "3months", "all"] as Range[]).includes(rangeParam as Range)
    ? (rangeParam as Range)
    : "month";

  const df = getDateFilter(range);

  const [
    [totalRows],
    [passRateRows],
    [avgScoreRows],
    [checkrideRows],
    [weakAreaRows],
    [distRows],
    [instrRows],
  ] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) as total FROM oral_sessions os
       JOIN school_members sm ON sm.user_id = os.user_id AND sm.school_id = ?
       WHERE os.overall_grade IS NOT NULL ${df}`,
      [schoolId]
    ),
    pool.query(
      `SELECT ROUND(SUM(CASE WHEN os.overall_grade = 'PASS' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*),0)) as pass_rate
       FROM oral_sessions os
       JOIN school_members sm ON sm.user_id = os.user_id AND sm.school_id = ?
       WHERE os.overall_grade IS NOT NULL ${df}`,
      [schoolId]
    ),
    pool.query(
      `SELECT ROUND(AVG(
         CASE sq.result
           WHEN 'PASS' THEN 100 WHEN 'PROBE' THEN 70
           WHEN 'REMEDIATE' THEN 40 WHEN 'FAIL' THEN 0
           ELSE NULL END
       )) as avg_score
       FROM session_questions sq
       JOIN oral_sessions os ON os.id = sq.session_id
       JOIN school_members sm ON sm.user_id = os.user_id AND sm.school_id = ?
       WHERE sq.result IS NOT NULL ${df}`,
      [schoolId]
    ),
    pool.query(
      `SELECT COUNT(*) as checkride_ready FROM (
         SELECT t.user_id
         FROM (
           SELECT os.user_id, os.overall_grade,
             ROW_NUMBER() OVER (PARTITION BY os.user_id ORDER BY os.started_at DESC) as rn
           FROM oral_sessions os
           JOIN school_members sm ON sm.user_id = os.user_id
           WHERE sm.school_id = ? AND sm.role = 'student' AND os.overall_grade IS NOT NULL
         ) t
         WHERE t.rn <= 3
         GROUP BY t.user_id
         HAVING COUNT(*) = 3 AND SUM(CASE WHEN t.overall_grade = 'PASS' THEN 1 ELSE 0 END) = 3
       ) ready`,
      [schoolId]
    ),
    pool.query(
      `SELECT
         sq.acs_task as code,
         COUNT(*) as total,
         SUM(CASE WHEN sq.result IN ('FAIL','REMEDIATE') THEN 1 ELSE 0 END) as failures,
         ROUND(SUM(CASE WHEN sq.result IN ('FAIL','REMEDIATE') THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as fail_rate
       FROM session_questions sq
       JOIN oral_sessions os ON os.id = sq.session_id
       JOIN school_members sm ON sm.user_id = os.user_id AND sm.school_id = ?
       WHERE sq.result IS NOT NULL AND sq.acs_task IS NOT NULL ${df}
       GROUP BY sq.acs_task
       ORDER BY fail_rate DESC
       LIMIT 10`,
      [schoolId]
    ),
    pool.query(
      `SELECT overall_grade, COUNT(*) as count
       FROM oral_sessions os
       JOIN school_members sm ON sm.user_id = os.user_id AND sm.school_id = ?
       WHERE os.overall_grade IS NOT NULL ${df}
       GROUP BY overall_grade`,
      [schoolId]
    ),
    pool.query(
      `SELECT
         u.id,
         u.name,
         COUNT(DISTINCT ist.student_id) as student_count,
         COUNT(DISTINCT os.id) as session_count,
         ROUND(AVG(CASE sq.result
           WHEN 'PASS' THEN 100 WHEN 'PROBE' THEN 70
           WHEN 'REMEDIATE' THEN 40 WHEN 'FAIL' THEN 0 ELSE NULL END)) as avg_score,
         ROUND(SUM(CASE WHEN os.overall_grade = 'PASS' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(DISTINCT os.id),0)) as pass_rate,
         MAX(os.started_at) as last_active
       FROM school_members sm
       JOIN users u ON u.id = sm.user_id
       LEFT JOIN instructor_students ist ON ist.instructor_id = u.id AND ist.school_id = sm.school_id
       LEFT JOIN oral_sessions os ON os.user_id = ist.student_id
       LEFT JOIN session_questions sq ON sq.session_id = os.id
       WHERE sm.school_id = ? AND sm.role = 'instructor'
       GROUP BY u.id, u.name
       ORDER BY pass_rate DESC`,
      [schoolId]
    ),
  ]);

  const gradeColorMap: Record<string, string> = {
    PASS: "#22c55e",
    PROBE: "#fbbf24",
    REMEDIATE: "#fb923c",
    FAIL: "#ef4444",
  };

  const scoreDistribution = (distRows as any[]).map((r: any) => ({
    name: r.overall_grade,
    count: Number(r.count),
    color: gradeColorMap[r.overall_grade] || "#94a3b8",
  }));

  return Response.json({
    metrics: {
      totalSessions: Number((totalRows as any[])[0]?.total || 0),
      passRate: Number((passRateRows as any[])[0]?.pass_rate || 0),
      avgScore: Number((avgScoreRows as any[])[0]?.avg_score || 0),
      checkrideReady: Number((checkrideRows as any[])[0]?.checkride_ready || 0),
    },
    weakAreas: (weakAreaRows as any[]).map((r: any) => ({
      code: r.code,
      failRate: Number(r.fail_rate),
      total: Number(r.total),
    })),
    scoreDistribution,
    instructorPerformance: (instrRows as any[]).map((r: any) => ({
      id: r.id,
      name: r.name,
      studentCount: Number(r.student_count),
      sessionCount: Number(r.session_count),
      avgScore: Number(r.avg_score || 0),
      passRate: Number(r.pass_rate || 0),
      lastActive: r.last_active,
    })),
  }, {
    headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=60" },
  });
}
