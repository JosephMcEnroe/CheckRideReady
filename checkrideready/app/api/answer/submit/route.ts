import { pool } from "@/lib/db";
import {
  evaluateWithOpenAI,
  type OpenAIEvaluation,
  type EvaluationResultCode,
} from "@/lib/evaluator/openai";

function getUserId(): string {
  return "demo-user";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isNonPass(result: EvaluationResultCode) {
  return result === "PROBE" || result === "REMEDIATE" || result === "FAIL";
}

function defaultEvaluation(acsTaskCode: string): OpenAIEvaluation {
  return {
    result: "PROBE",
    confidence: 0.0,
    feedback: "Model error - please expand your answer",
    missing_points: [],
    probe_question: null,
    acs_task_code: acsTaskCode,
  };
}

function masteryDeltaFromEvaluation(e: OpenAIEvaluation) {
  const c = clamp(e.confidence, 0, 1);
  if (e.result === "PASS") return 0.4 + 0.4 * c;
  if (e.result === "PROBE") return 0.05 + 0.15 * c;
  if (e.result === "REMEDIATE") return -(0.3 + 0.4 * c);
  return -(0.6 + 0.4 * c);
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

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "Missing OPENAI_API_KEY server environment variable" },
      { status: 500 }
    );
  }

  try {
    const userId = getUserId();

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
    if (session.status !== "active") {
      return Response.json({ error: "Session not active" }, { status: 400 });
    }

    const baseQuestionId = questionId.includes("__probe_")
      ? questionId.split("__probe_")[0]
      : questionId;

    const [qRows] = await pool.execute(
      `SELECT id, acs_task_code, stem
       FROM questions
       WHERE id = ?
       LIMIT 1`,
      [baseQuestionId]
    );
    const question = (qRows as any[])[0] as
      | { id: string; acs_task_code: string; stem: string }
      | undefined;
    if (!question) return Response.json({ error: "Question not found" }, { status: 404 });

    const evalResult =
      (await evaluateWithOpenAI({
        questionStem: question.stem,
        studentAnswer: answer,
        acsTaskCode: question.acs_task_code,
      })) || defaultEvaluation(question.acs_task_code);

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
        baseQuestionId,
        question.acs_task_code,
        answer,
        evalResult.result,
        evalResult.missing_points.length,
        evalResult.result === "FAIL" ? 1 : 0,
        evalResult.confidence,
      ]
    );

    const delta = masteryDeltaFromEvaluation(evalResult);

    await Promise.all([
      pool.execute(
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
          question.acs_task_code,
          clamp(delta, 0, 5),
          evalResult.result === "PASS" ? 1 : 0,
          isNonPass(evalResult.result) ? 1 : 0,
          delta,
        ]
      ),
      pool.execute(
        `
        UPDATE sessions
        SET last_result = ?,
            last_feedback = ?,
            last_probe_question = ?,
            probe_count_for_task =
              CASE
                WHEN ? IN ('PROBE','REMEDIATE','FAIL') THEN LEAST(max_probes_per_task, probe_count_for_task + 1)
                ELSE 0
              END,
            current_acs_task_code = ?,
            current_question_id = ?
        WHERE id = ?
        `,
        [
          evalResult.result,
          evalResult.feedback,
          evalResult.probe_question,
          evalResult.result,
          question.acs_task_code,
          baseQuestionId,
          sessionId,
        ]
      ),
    ]);

    return Response.json({
      attemptId,
      ...evalResult,
    });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || "Answer evaluation failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json(
    { error: "Method not allowed. Use POST /api/answer/submit." },
    { status: 405 }
  );
}
