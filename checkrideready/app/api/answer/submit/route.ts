import { pool } from "@/lib/db";

type Result = "PASS" | "PROBE" | "REMEDIATE" | "FAIL";

function getUserId(): string {
  return "demo-user";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// VERY SIMPLE evaluator (placeholder)
// Later we replace this with OpenAI JSON evaluation.
function stubEvaluate(answer: string): {
  result: Result;
  feedback: string;
  confidence: number;
  missing: number;
  redFlags: number;
} {
  const a = answer.trim();
  const words = a.split(/\s+/).filter(Boolean).length;

  // crude “red flag” example: unsafe logic signals
  const redFlagPhrases = ["doesn't matter", "optional", "ignore", "always fine", "never check"];
  const redFlags = redFlagPhrases.some((p) => a.toLowerCase().includes(p)) ? 1 : 0;

  if (redFlags > 0) {
    return {
      result: "REMEDIATE",
      feedback:
        "Red flag: your answer suggests skipping required safety/legal checks. Slow down and restate a safety-first process.",
      confidence: 0.8,
      missing: 2,
      redFlags,
    };
  }

  if (words < 25) {
    return {
      result: "PROBE",
      feedback:
        "Too thin. Give a structured answer: what you check, where you verify it, and why it matters.",
      confidence: 0.6,
      missing: 3,
      redFlags: 0,
    };
  }

  return {
    result: "PASS",
    feedback:
      "Good structure. Next time, add one or two concrete references (e.g., where in logs/reg you verify).",
    confidence: 0.7,
    missing: 1,
    redFlags: 0,
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const sessionId = body?.sessionId as string | undefined;
  const questionId = body?.questionId as string | undefined;
  const answer = body?.answer as string | undefined;

  if (!sessionId || !questionId || !answer) {
    return Response.json(
      { error: "Missing sessionId, questionId, or answer" },
      { status: 400 }
    );
  }

  const userId = getUserId();

  // Load session and verify ownership
  const [sRows] = await pool.execute(
    `SELECT id, user_id, status
     FROM sessions
     WHERE id = ?
     LIMIT 1`,
    [sessionId]
  );
  const session = (sRows as any[])[0];

  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
  if (session.user_id !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (session.status !== "active")
    return Response.json({ error: "Session not active" }, { status: 400 });

  // Load question (need ACS code for logging + mastery)
  const [qRows] = await pool.execute(
    `SELECT id, acs_task_code
     FROM questions
     WHERE id = ?
     LIMIT 1`,
    [questionId]
  );
  const question = (qRows as any[])[0];
  if (!question) return Response.json({ error: "Question not found" }, { status: 404 });

  const acsTask = question.acs_task_code as string;

  // Evaluate (stub for now)
  const evalResult = stubEvaluate(answer);

  // Log attempt
  const attemptId = crypto.randomUUID();
  await pool.execute(
    `INSERT INTO attempt_log
      (id, session_id, user_id, question_id, acs_task_code, student_answer, result, missing_count, red_flag_count, model_confidence)
     VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attemptId,
      sessionId,
      userId,
      questionId,
      acsTask,
      answer,
      evalResult.result,
      evalResult.missing,
      evalResult.redFlags,
      evalResult.confidence,
    ]
  );

  // Update mastery (0–5) per ACS task
  // Simple rule:
  // PASS +0.7, PROBE +0.2, REMEDIATE -0.6, FAIL -1.0
  let delta = 0;
  if (evalResult.result === "PASS") delta = 0.7;
  if (evalResult.result === "PROBE") delta = 0.2;
  if (evalResult.result === "REMEDIATE") delta = -0.6;
  if (evalResult.result === "FAIL") delta = -1.0;

  // Upsert user_skill
  await pool.execute(
    `
    INSERT INTO user_skill (user_id, acs_task_code, mastery, last_seen_at, attempts, passes, fails)
    VALUES (?, ?, ?, NOW(), 1, ?, ?)
    ON DUPLICATE KEY UPDATE
      mastery = LEAST(5.0, GREATEST(0.0, mastery + ?)),
      last_seen_at = NOW(),
      attempts = attempts + 1,
      passes = passes + VALUES(passes),
      fails = fails + VALUES(fails)
    `,
    [
      userId,
      acsTask,
      clamp(delta, 0, 5),
      evalResult.result === "PASS" ? 1 : 0,
      evalResult.result === "REMEDIATE" || evalResult.result === "FAIL" ? 1 : 0,
      delta,
    ]
  );

  // ✅ Step A2: update session state so /api/sessions/next can behave like a DPE
  // NOTE: Requires sessions.last_result and sessions.last_feedback columns (ALTER TABLE step).
  await pool.execute(
    `
    UPDATE sessions
    SET last_result = ?,
        last_feedback = ?,
        probe_count_for_task =
          CASE
            WHEN ? = 'PROBE' THEN LEAST(max_probes_per_task, probe_count_for_task + 1)
            ELSE 0
          END,
        current_acs_task_code = ?,
        current_question_id = ?
    WHERE id = ?
    `,
    [
      evalResult.result,
      evalResult.feedback,
      evalResult.result,
      acsTask,
      questionId,
      sessionId,
    ]
  );

  return Response.json({
    attemptId,
    result: evalResult.result,
    feedback: evalResult.feedback,
    confidence: evalResult.confidence,
    acs_task_code: acsTask,
  });
}
