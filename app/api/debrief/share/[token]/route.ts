import { pool } from "@/lib/db";

type ResultCode = "PASS" | "PROBE" | "REMEDIATE" | "FAIL";

function getScorePercent(questions: Array<{ result: string | null }>) {
  const weights: Record<string, number> = { PASS: 1, PROBE: 0.75, REMEDIATE: 0.5, FAIL: 0 };
  const graded = questions.filter((q) => q.result !== null);
  if (graded.length === 0) return 0;
  const avg = graded.reduce((sum, q) => sum + (weights[q.result!] ?? 0), 0) / graded.length;
  return Math.round(avg * 100);
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [tokenRows] = await pool.execute(
    `SELECT st.session_id FROM share_tokens st WHERE st.token = ? LIMIT 1`,
    [token]
  );
  if ((tokenRows as any[]).length === 0) {
    return Response.json({ error: "Debrief not found" }, { status: 404 });
  }

  const sessionId = (tokenRows as any[])[0].session_id;

  const [[sessionRows], [questionRows]] = await Promise.all([
    pool.execute(
      `SELECT os.id, os.mode, os.overall_grade, os.overall_summary, os.started_at,
         u.name as student_name
       FROM oral_sessions os
       JOIN users u ON u.id = os.user_id
       WHERE os.id = ?`,
      [sessionId]
    ),
    pool.execute(
      `SELECT question_text, user_answer, ai_feedback, result, acs_task
       FROM session_questions
       WHERE session_id = ? AND user_answer IS NOT NULL
       ORDER BY created_at ASC`,
      [sessionId]
    ),
  ]);

  const session = (sessionRows as any[])[0];
  if (!session) return Response.json({ error: "Debrief not found" }, { status: 404 });

  const questions = questionRows as any[];
  const score = getScorePercent(questions);

  // First name only for privacy
  const fullName: string = session.student_name || "";
  const studentFirstName = fullName.split(" ")[0] || "Student";

  return Response.json({
    session: {
      id: session.id,
      mode: session.mode,
      overall_grade: session.overall_grade,
      overall_summary: session.overall_summary,
      started_at: session.started_at,
    },
    questions: questions.map((q) => ({
      question_text: q.question_text,
      user_answer: q.user_answer,
      ai_feedback: q.ai_feedback,
      result: q.result as ResultCode | null,
      acs_task: q.acs_task,
    })),
    score,
    studentFirstName,
  });
}
