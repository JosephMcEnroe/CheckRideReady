import { pool } from "@/lib/db";
import { computeOverallGrade, type SessionResult } from "@/lib/session-grading";

type DbSessionRow = {
  id: string;
  user_id: string;
  mode: string;
  status: "active" | "completed";
  started_at: string | null;
  ended_at: string | null;
  overall_grade: SessionResult | null;
  overall_summary: string | null;
  current_question_id: string | null;
  current_acs_task_code: string | null;
};

type DbQuestionRow = {
  id: number;
  question_id: string | null;
  acs_task: string | null;
  question_text: string;
  user_answer: string | null;
  ai_feedback: string | null;
  result: SessionResult | null;
  is_probe: 0 | 1;
  created_at: string;
  acs_area: string | null;
};

export type SessionQuestionResult = {
  id: number;
  question_id: string | null;
  acs_task: string | null;
  acs_area: string | null;
  question_text: string;
  user_answer: string | null;
  ai_feedback: string | null;
  result: SessionResult | null;
  is_probe: boolean;
  created_at: string;
  is_right: boolean;
  verdict: "RIGHT" | "NEEDS_WORK";
};

export type SessionResultsPayload = {
  session: {
    id: string;
    rating_type: string;
    status: "active" | "completed";
    started_at: string | null;
    ended_at: string | null;
    overall_grade: SessionResult;
    overall_summary: string | null;
    current_question_id: string | null;
    current_acs_task_code: string | null;
  };
  counts: {
    total: number;
    passCount: number;
    probeCount: number;
    remediateCount: number;
    failCount: number;
  };
  questions: SessionQuestionResult[];
};

export async function getSessionResults(
  sessionId: string,
  userId: string
): Promise<SessionResultsPayload | null> {
  const [sRows] = await pool.execute(
    `SELECT id, user_id, mode, status, started_at, ended_at, overall_grade, overall_summary,
            current_question_id, current_acs_task_code
       FROM oral_sessions
      WHERE id = ?
        AND user_id = ?
      LIMIT 1`,
    [sessionId, userId]
  );

  const session = (sRows as DbSessionRow[])[0];
  if (!session) return null;

  const [questionRows] = await pool.execute(
    `SELECT
        sq.id,
        sq.question_id,
        sq.acs_task,
        sq.question_text,
        sq.user_answer,
        sq.ai_feedback,
        sq.result,
        sq.is_probe,
        sq.created_at,
        q.acs_area
      FROM session_questions sq
      LEFT JOIN questions q ON q.id = sq.question_id
      WHERE sq.session_id = ?
      ORDER BY sq.created_at ASC, sq.id ASC`,
    [sessionId]
  );

  const questions: SessionQuestionResult[] = (questionRows as DbQuestionRow[]).map((q) => ({
    id: q.id,
    question_id: q.question_id,
    acs_task: q.acs_task,
    acs_area: q.acs_area,
    question_text: q.question_text,
    user_answer: q.user_answer,
    ai_feedback: q.ai_feedback,
    result: q.result,
    is_probe: q.is_probe === 1,
    created_at: q.created_at,
    is_right: q.result === "PASS",
    verdict: q.result === "PASS" ? "RIGHT" : "NEEDS_WORK",
  }));

  const counts = {
    total: questions.filter((q) => q.result !== null).length,
    passCount: questions.filter((q) => q.result === "PASS").length,
    probeCount: questions.filter((q) => q.result === "PROBE").length,
    remediateCount: questions.filter((q) => q.result === "REMEDIATE").length,
    failCount: questions.filter((q) => q.result === "FAIL").length,
  };

  const effectiveOverallGrade =
    session.overall_grade ||
    computeOverallGrade({
      passCount: counts.passCount,
      probeCount: counts.probeCount,
      remediateCount: counts.remediateCount,
      failCount: counts.failCount,
    });

  return {
    session: {
      id: session.id,
      rating_type: session.mode,
      status: session.status,
      started_at: session.started_at ?? null,
      ended_at: session.ended_at ?? null,
      overall_grade: effectiveOverallGrade,
      overall_summary: session.overall_summary ?? null,
      current_question_id: session.current_question_id ?? null,
      current_acs_task_code: session.current_acs_task_code ?? null,
    },
    counts,
    questions,
  };
}

