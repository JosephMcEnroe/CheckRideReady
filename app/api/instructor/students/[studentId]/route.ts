import { pool } from "@/lib/db";
import { auth } from "@/auth";

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId } = await params;

  // Verify caller is assigned instructor OR admin in the same school
  const [assignRows] = await pool.execute(
    `SELECT id FROM instructor_students WHERE instructor_id = ? AND student_id = ? LIMIT 1`,
    [userId, studentId]
  );
  const isInstructor = (assignRows as any[]).length > 0;

  if (!isInstructor) {
    const [adminRows] = await pool.execute(
      `SELECT sm1.id FROM school_members sm1
       JOIN school_members sm2 ON sm2.school_id = sm1.school_id
       WHERE sm1.user_id = ? AND sm1.role = 'admin' AND sm2.user_id = ?
       LIMIT 1`,
      [userId, studentId]
    );
    if ((adminRows as any[]).length === 0) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const [studentRows] = await pool.execute(
    `SELECT id, name, email, certificate_goal FROM users WHERE id = ? LIMIT 1`,
    [studentId]
  );
  const student = (studentRows as any[])[0];
  if (!student) return Response.json({ error: "Student not found" }, { status: 404 });

  // Run all remaining queries in parallel
  const [
    sessionRows,
    skillRows,
    trendRows,
    noteRows,
    sessionStats,
    questionStats,
    recentRows,
  ] = await Promise.all([
    pool.execute(
      `SELECT id, mode, status, overall_grade, started_at, ended_at,
         ROUND((
           SELECT AVG(CASE result WHEN 'PASS' THEN 100 WHEN 'PROBE' THEN 70 WHEN 'REMEDIATE' THEN 40 WHEN 'FAIL' THEN 0 END)
           FROM session_questions
           WHERE session_id = os.id AND result IS NOT NULL
         )) as score
       FROM oral_sessions os
       WHERE user_id = ?
       ORDER BY started_at DESC
       LIMIT 20`,
      [studentId]
    ),
    pool.execute(
      `SELECT acs_task_code, mastery, attempts, passes, fails
       FROM user_skill WHERE user_id = ? ORDER BY mastery ASC`,
      [studentId]
    ),
    pool.execute(
      `SELECT id, started_at,
         ROUND((
           SELECT AVG(CASE result WHEN 'PASS' THEN 100 WHEN 'PROBE' THEN 70 WHEN 'REMEDIATE' THEN 40 WHEN 'FAIL' THEN 0 END)
           FROM session_questions WHERE session_id = os.id AND result IS NOT NULL
         )) as score
       FROM oral_sessions os
       WHERE user_id = ?
       ORDER BY started_at DESC
       LIMIT 10`,
      [studentId]
    ),
    pool.execute(
      `SELECT cn.id, cn.note_text, cn.created_at
       FROM cfi_notes cn
       WHERE cn.student_id = ?
         AND (cn.instructor_id = ? OR EXISTS (
           SELECT 1 FROM school_members WHERE user_id = ? AND role = 'admin'
         ))
       ORDER BY cn.created_at DESC`,
      [studentId, userId, userId]
    ),
    pool.query(
      `SELECT
         COUNT(*) as total_sessions,
         SUM(CASE WHEN overall_grade = 'PASS' THEN 1 ELSE 0 END) as pass_count
       FROM oral_sessions
       WHERE user_id = ? AND overall_grade IS NOT NULL`,
      [studentId]
    ),
    pool.query(
      `SELECT COUNT(*) as total
       FROM session_questions sq
       JOIN oral_sessions os ON os.id = sq.session_id
       WHERE os.user_id = ? AND sq.result IS NOT NULL`,
      [studentId]
    ),
    pool.query(
      `SELECT
         os.id, os.mode, os.overall_grade, os.started_at,
         COALESCE(topic.acs_task, os.mode) as topic,
         ROUND(AVG(
           CASE sq.result
             WHEN 'PASS' THEN 100 WHEN 'PROBE' THEN 70
             WHEN 'REMEDIATE' THEN 40 WHEN 'FAIL' THEN 0
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
       WHERE os.user_id = ? AND os.overall_grade IS NOT NULL
       GROUP BY os.id, os.mode, os.overall_grade, os.started_at, topic.acs_task
       ORDER BY os.started_at DESC
       LIMIT 5`,
      [studentId]
    ),
  ]);

  const scoreTrend = (trendRows[0] as any[]).reverse();

  // Progress calculations
  const skills = skillRows[0] as Array<{
    acs_task_code: string;
    mastery: number;
    attempts: number;
    passes: number;
    fails: number;
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

  const readiness =
    skills.length > 0
      ? Math.round(skills.reduce((sum, s) => sum + (s.mastery / 5) * 100, 0) / skills.length)
      : 0;

  const withAttempts = skills.filter((s) => s.attempts > 0);
  const weakestSkill = withAttempts.length > 0 ? withAttempts[0] : null;
  const weakestArea = weakestSkill
    ? ACS_AREA_NAMES[weakestSkill.acs_task_code] ?? weakestSkill.acs_task_code
    : "None";

  const totalSessions = Number(stats.total_sessions) || 0;
  const passCount = Number(stats.pass_count) || 0;
  const passRate = totalSessions > 0 ? Math.round((passCount / totalSessions) * 100) : 0;

  const acsAreas = skills.map((s) => {
    const masteryPct = Math.round((s.mastery / 5) * 100);
    let status: "Strong" | "Developing" | "Needs Work" | "Not Started";
    if (s.attempts === 0) status = "Not Started";
    else if (masteryPct >= 80) status = "Strong";
    else if (masteryPct >= 60) status = "Developing";
    else status = "Needs Work";
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

  const recentSessions = recent.map((r) => ({
    id: r.id,
    mode: r.mode,
    topic: r.topic,
    score: r.score !== null ? Number(r.score) : null,
    result: r.overall_grade,
    date: r.started_at,
  }));

  return Response.json({
    student,
    sessions: sessionRows[0],
    acsAreas,
    scoreTrend,
    notes: noteRows[0],
    readiness,
    stats: {
      totalSessions,
      questionsAnswered: Number(qStats.total) || 0,
      passRate,
      weakestArea,
    },
    recentSessions,
  }, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=30" },
  });
}
