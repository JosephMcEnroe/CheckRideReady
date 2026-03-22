import { auth } from "@/auth";
import { pool } from "@/lib/db";

const ACS_AREA_NAMES: Record<string, string> = {
  "PA.I.A": "Pilot Qualifications",
  "PA.I.B": "Airworthiness",
  "PA.I.C": "Weather Theory",
  "PA.I.D": "Cross Country Flight",
  "PA.I.E": "National Airspace",
  "PA.I.F": "Performance & Limitations",
  "PA.I.G": "Aircraft Systems",
  "PA.I.H": "Aeromedical",
  "PA.II.A": "Preflight",
  "PA.III.A": "Airport Operations",
  "PA.IV.A": "Radio Communications",
  "PA.VI.A": "Emergency Procedures",
  "PA.VII.A": "Night Operations",
  "PA.VIII.A": "Navigation",
};

export async function GET() {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [skillRows, sessionStats, questionStats, recentRows] = await Promise.all([
    pool.query(
      `SELECT acs_task_code, mastery, attempts, passes, fails, last_seen_at
       FROM user_skill
       WHERE user_id = ?
       ORDER BY mastery ASC`,
      [userId]
    ),
    pool.query(
      `SELECT
         COUNT(*) as total_sessions,
         SUM(CASE WHEN overall_grade = 'PASS' THEN 1 ELSE 0 END) as pass_count
       FROM oral_sessions
       WHERE user_id = ? AND overall_grade IS NOT NULL`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(*) as total
       FROM session_questions sq
       JOIN oral_sessions os ON os.id = sq.session_id
       WHERE os.user_id = ? AND sq.result IS NOT NULL`,
      [userId]
    ),
    pool.query(
      `SELECT
         os.id,
         os.mode,
         os.overall_grade,
         os.started_at,
         COALESCE(topic.acs_task, os.mode) as topic,
         ROUND(AVG(
           CASE sq.result
             WHEN 'PASS' THEN 100
             WHEN 'PROBE' THEN 70
             WHEN 'REMEDIATE' THEN 40
             WHEN 'FAIL' THEN 0
             ELSE NULL END
         )) as score
       FROM oral_sessions os
       LEFT JOIN session_questions sq ON sq.session_id = os.id AND sq.result IS NOT NULL
       LEFT JOIN (
         SELECT session_id, acs_task
         FROM session_questions
         WHERE id IN (
           SELECT MIN(id) FROM session_questions
           WHERE acs_task IS NOT NULL
           GROUP BY session_id
         )
       ) topic ON topic.session_id = os.id
       WHERE os.user_id = ?
       AND os.overall_grade IS NOT NULL
       GROUP BY os.id, os.mode, os.overall_grade, os.started_at, topic.acs_task
       ORDER BY os.started_at DESC
       LIMIT 5`,
      [userId]
    ),
  ]);

  const skills = skillRows[0] as Array<{
    acs_task_code: string;
    mastery: number;
    attempts: number;
    passes: number;
    fails: number;
    last_seen_at: string | null;
  }>;

  const stats = (sessionStats[0] as Array<{ total_sessions: number; pass_count: number }>)[0];
  const qStats = (questionStats[0] as Array<{ total: number }>)[0];
  const recent = recentRows[0] as Array<{
    id: string;
    mode: string;
    overall_grade: string;
    started_at: string;
    topic: string;
    score: number | null;
  }>;

  // Readiness score
  const readiness =
    skills.length > 0
      ? Math.round(
          skills.reduce((sum, s) => sum + (s.mastery / 5) * 100, 0) / skills.length
        )
      : 0;

  // Weakest area (lowest mastery with attempts > 0)
  const withAttempts = skills.filter((s) => s.attempts > 0);
  const weakestSkill = withAttempts.length > 0 ? withAttempts[0] : null;
  const weakestArea = weakestSkill
    ? ACS_AREA_NAMES[weakestSkill.acs_task_code] ?? weakestSkill.acs_task_code
    : "None";

  // Pass rate
  const totalSessions = Number(stats.total_sessions) || 0;
  const passCount = Number(stats.pass_count) || 0;
  const passRate = totalSessions > 0 ? Math.round((passCount / totalSessions) * 100) : 0;

  // ACS areas
  const acsAreas = skills.map((s) => {
    const masteryPct = Math.round((s.mastery / 5) * 100);
    let status: "Strong" | "Developing" | "Needs Work" | "Not Started";
    if (s.attempts === 0) {
      status = "Not Started";
    } else if (masteryPct >= 80) {
      status = "Strong";
    } else if (masteryPct >= 60) {
      status = "Developing";
    } else {
      status = "Needs Work";
    }
    return {
      code: s.acs_task_code,
      name: ACS_AREA_NAMES[s.acs_task_code] ?? s.acs_task_code,
      masteryPct,
      attempts: s.attempts,
      passes: s.passes,
      fails: s.fails,
      status,
    };
  });

  // Recent sessions
  const recentSessions = recent.map((r) => ({
    id: r.id,
    mode: r.mode,
    topic: r.topic,
    score: r.score !== null ? Number(r.score) : null,
    result: r.overall_grade,
    date: r.started_at,
  }));

  return Response.json({
    readiness,
    stats: {
      totalSessions,
      questionsAnswered: Number(qStats.total) || 0,
      passRate,
      weakestArea,
    },
    acsAreas,
    recentSessions,
  });
}
