import { pool } from "@/lib/db";
import { auth } from "@/auth";

const toNum = (v: any) => (v === null || v === undefined ? 0 : Number(v));

export async function GET() {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [rows] = await pool.execute(
    `
    SELECT
      s.id,
      s.started_at,
      s.ended_at,
      s.mode AS rating_type,
      s.status,
      s.overall_grade,
      s.overall_summary,
      COALESCE(q.passCount, 0) AS passCount,
      COALESCE(q.probeCount, 0) AS probeCount,
      COALESCE(q.remediateCount, 0) AS remediateCount,
      COALESCE(q.failCount, 0) AS failCount,
      COALESCE(q.total, 0) AS total
    FROM oral_sessions s
    LEFT JOIN (
      SELECT
        session_id,
        COUNT(*) AS total,
        SUM(result = 'PASS') AS passCount,
        SUM(result = 'PROBE') AS probeCount,
        SUM(result = 'REMEDIATE') AS remediateCount,
        SUM(result = 'FAIL') AS failCount
      FROM session_questions
      WHERE result IS NOT NULL
      GROUP BY session_id
    ) q ON q.session_id = s.id
    WHERE s.user_id = ?
    ORDER BY s.started_at DESC
    LIMIT 100
    `,
    [userId]
  );

  return Response.json({
    sessions: (rows as any[]).map((row) => ({
      ...row,
      passCount: toNum(row.passCount),
      probeCount: toNum(row.probeCount),
      remediateCount: toNum(row.remediateCount),
      failCount: toNum(row.failCount),
      total: toNum(row.total),
    })),
  });
}

