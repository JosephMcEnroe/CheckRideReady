import { pool } from "@/lib/db";

function getUserId(): string {
  return "demo-user";
}

const toNum = (v: any) => (v === null || v === undefined ? 0 : Number(v));

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      return Response.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const userId = getUserId();

    const [sRows] = await pool.execute(
      `SELECT id, user_id, mode, status, created_at
       FROM sessions
       WHERE id = ?
       LIMIT 1`,
      [sessionId]
    );

    const session = (sRows as any[])[0];

    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const [attemptRows] = await pool.execute(
      `
      SELECT
        a.id,
        a.created_at,
        a.result,
        a.acs_task_code,
        a.question_id,
        q.acs_area,
        q.stem
      FROM attempt_log a
      LEFT JOIN questions q ON q.id = a.question_id
      WHERE a.session_id = ?
      ORDER BY a.created_at DESC
      LIMIT 30
      `,
      [sessionId]
    );

    const [countRows] = await pool.execute(
      `
      SELECT
        COUNT(*) AS total,
        SUM(result='PASS') AS passCount,
        SUM(result='PROBE') AS probeCount,
        SUM(result='REMEDIATE') AS remediateCount,
        SUM(result='FAIL') AS failCount
      FROM attempt_log
      WHERE session_id = ?
      `,
      [sessionId]
    );

    const rawCounts = (countRows as any[])[0] || {};

    const counts = {
      total: toNum(rawCounts.total),
      passCount: toNum(rawCounts.passCount),
      probeCount: toNum(rawCounts.probeCount),
      remediateCount: toNum(rawCounts.remediateCount),
      failCount: toNum(rawCounts.failCount),
    };

    const [weakRows] = await pool.execute(
      `
      SELECT
        us.acs_task_code,
        us.mastery,
        us.attempts,
        us.passes,
        us.fails,
        MAX(q.acs_area) AS acs_area
      FROM user_skill us
      LEFT JOIN questions q
        ON q.acs_task_code = us.acs_task_code
      WHERE us.user_id = ?
      GROUP BY us.acs_task_code, us.mastery, us.attempts, us.passes, us.fails
      ORDER BY us.mastery ASC, us.attempts DESC
      LIMIT 8
      `,
      [userId]
    );

    const [strongRows] = await pool.execute(
      `
      SELECT
        us.acs_task_code,
        us.mastery,
        us.attempts,
        us.passes,
        us.fails,
        MAX(q.acs_area) AS acs_area
      FROM user_skill us
      LEFT JOIN questions q
        ON q.acs_task_code = us.acs_task_code
      WHERE us.user_id = ?
      GROUP BY us.acs_task_code, us.mastery, us.attempts, us.passes, us.fails
      ORDER BY us.mastery DESC, us.attempts DESC
      LIMIT 8
      `,
      [userId]
    );

    const [probedRows] = await pool.execute(
      `
      SELECT
        a.acs_task_code,
        COUNT(*) AS probes,
        MAX(q.acs_area) AS acs_area
      FROM attempt_log a
      LEFT JOIN questions q
        ON q.acs_task_code = a.acs_task_code
      WHERE a.session_id = ?
        AND a.result = 'PROBE'
      GROUP BY a.acs_task_code
      ORDER BY probes DESC
      LIMIT 8
      `,
      [sessionId]
    );

    return Response.json({
      session: {
        id: session.id,
        mode: session.mode,
        status: session.status,
        created_at: session.created_at ?? null,
      },
      counts,
      weakest: (weakRows as any[]).map((r) => ({
        ...r,
        mastery: toNum(r.mastery),
        attempts: toNum(r.attempts),
        passes: toNum(r.passes),
        fails: toNum(r.fails),
      })),
      strongest: (strongRows as any[]).map((r) => ({
        ...r,
        mastery: toNum(r.mastery),
        attempts: toNum(r.attempts),
        passes: toNum(r.passes),
        fails: toNum(r.fails),
      })),
      mostProbed: (probedRows as any[]).map((r) => ({
        ...r,
        probes: toNum(r.probes),
      })),
      attempts: attemptRows,
    });
  } catch (err: any) {
    return Response.json(
      {
        error: err?.message || "Results API crashed",
        code: err?.code,
        sqlMessage: err?.sqlMessage,
      },
      { status: 500 }
    );
  }
}
