import { pool } from "@/lib/db";
import { auth } from "@/auth";

// To clean dev data:
// DELETE FROM attempt_log;
// DELETE FROM session_questions;
// DELETE FROM oral_sessions;

type SessionListRow = {
  id: string;
  created_at: string;
  topic: string | null;
  last_result: "PASS" | "PROBE" | "REMEDIATE" | "FAIL" | null;
  score: number | null;
  duration_seconds: number | null;
  question_count: number | null;
};

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
      COALESCE(s.started_at, s.created_at) AS created_at,
      COALESCE(topic.latest_topic, s.current_acs_task_code, s.mode) AS topic,
      s.last_result,
      stats.score,
      CASE
        WHEN s.started_at IS NULL THEN NULL
        WHEN s.ended_at IS NULL THEN TIMESTAMPDIFF(SECOND, s.started_at, NOW())
        ELSE TIMESTAMPDIFF(SECOND, s.started_at, s.ended_at)
      END AS duration_seconds,
      stats.question_count
    FROM oral_sessions s
    LEFT JOIN (
      SELECT
        sq.session_id,
        ROUND(
          AVG(
            CASE sq.result
              WHEN 'PASS' THEN 1.0
              WHEN 'PROBE' THEN 0.7
              WHEN 'REMEDIATE' THEN 0.4
              WHEN 'FAIL' THEN 0.0
              ELSE NULL
            END
          ) * 100
        ) AS score,
        COUNT(*) AS question_count
      FROM session_questions sq
      WHERE sq.result IS NOT NULL
      GROUP BY sq.session_id
    ) stats ON stats.session_id = s.id
    LEFT JOIN (
      SELECT sq1.session_id, sq1.acs_task AS latest_topic
      FROM session_questions sq1
      INNER JOIN (
        SELECT session_id, MAX(id) AS max_id
        FROM session_questions
        GROUP BY session_id
      ) latest ON latest.session_id = sq1.session_id AND latest.max_id = sq1.id
    ) topic ON topic.session_id = s.id
    WHERE s.user_id = ?
    ORDER BY COALESCE(s.started_at, s.created_at) DESC
    LIMIT 100
    `,
    [userId]
  );

  const sessions = (rows as SessionListRow[]).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    topic: row.topic,
    last_result: row.last_result,
    score: row.score === null ? null : Number(row.score),
    duration_seconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    question_count: row.question_count === null ? null : Number(row.question_count),
  }));

  return Response.json({ sessions });
}

