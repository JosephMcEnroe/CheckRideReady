import { pool } from "@/lib/db";

function getUserId(): string {
  return "demo-user";
}

const toNum = (v: any) => (v === null || v === undefined ? 0 : Number(v));

export async function GET() {
  const userId = getUserId();

  const [rows] = await pool.execute(
    `
    SELECT
      s.id,
      s.mode,
      s.status,
      s.created_at,

      COALESCE(a.total, 0) AS total,
      COALESCE(a.passCount, 0) AS passCount,
      COALESCE(a.probeCount, 0) AS probeCount,
      COALESCE(a.remediateCount, 0) AS remediateCount,
      COALESCE(a.failCount, 0) AS failCount,

      COALESCE(a.lastAttemptAt, s.created_at) AS lastAttemptAt
    FROM sessions s
    LEFT JOIN (
      SELECT
        session_id,
        COUNT(*) AS total,
        SUM(result='PASS') AS passCount,
        SUM(result='PROBE') AS probeCount,
        SUM(result='REMEDIATE') AS remediateCount,
        SUM(result='FAIL') AS failCount,
        MAX(created_at) AS lastAttemptAt
      FROM attempt_log
      GROUP BY session_id
    ) a ON a.session_id = s.id
    WHERE s.user_id = ?
    ORDER BY lastAttemptAt DESC
    LIMIT 50
    `,
    [userId]
  );

  const sessions = (rows as any[]).map((s) => ({
    ...s,
    total: toNum(s.total),
    passCount: toNum(s.passCount),
    probeCount: toNum(s.probeCount),
    remediateCount: toNum(s.remediateCount),
    failCount: toNum(s.failCount),
  }));

  return Response.json({ sessions });
}
