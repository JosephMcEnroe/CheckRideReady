import { pool } from "@/lib/db";
import {
  evaluateWithOpenAI,
  type OpenAIEvaluation,
  type EvaluationResultCode,
} from "@/lib/evaluator/openai";
import { buildOverallSummary, computeOverallGrade } from "@/lib/session-grading";
import { auth } from "@/auth";

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
    feedback: "Evaluation temporarily unavailable. Your answer was recorded — continue to the next question.",
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

function isMastery(e: OpenAIEvaluation) {
  return e.result === "PASS" && e.confidence >= 0.8 && e.missing_points.length === 0;
}

function normalizeText(v: string) {
  return v.toLowerCase().replace(/\s+/g, " ").trim();
}

function buildFallbackFollowUp(
  questionStem: string,
  escalationLevel: number,
  missingPoints: string[]
) {
  const focus = missingPoints[0]?.trim()
    .replace(/^mention of /i, "")
    .replace(/^lack of /i, "")
    .replace(/^missing /i, "")
    .trim();
  if (focus) {
    return `Walk me through ${focus} in this scenario, including your exact decision points and why.`;
  }
  if (escalationLevel >= 2) {
    return `Now add a realistic complication to this scenario and explain how your decision changes step-by-step.`;
  }
  return `What specific factors would change your decision in this scenario, and how would you apply them in your aircraft?`;
}

export async function POST(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  const sessionId = body?.sessionId as string | undefined;
  const questionId = body?.questionId as string | undefined;
  const sessionQuestionId = body?.sessionQuestionId as string | number | undefined;
  const answer = body?.answer as string | undefined;

  if (!sessionId || !answer || (!questionId && !sessionQuestionId)) {
    return Response.json(
      { error: "Missing sessionId, answer, and question reference" },
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
    const [sRows] = await pool.execute(
      `SELECT id, user_id, status, current_question_id, current_acs_task_code, probe_count_for_task, max_probes_per_task,
              session_weather, airport, aircraft, airport_source
       FROM oral_sessions
       WHERE id = ?
         AND user_id = ?
       LIMIT 1`,
      [sessionId, userId]
    );
    const session = (sRows as any[])[0];

    if (!session) return Response.json({ error: "Forbidden" }, { status: 403 });
    if (session.status !== "active") {
      return Response.json({ error: "Session not active" }, { status: 400 });
    }

    const baseQuestionId =
      questionId && questionId.includes("__probe_")
        ? questionId.split("__probe_")[0]
        : questionId || session.current_question_id;

    let promptRow:
      | { id: string; session_id: string; acs_task: string | null; question_text: string }
      | undefined;

    if (sessionQuestionId) {
      const [sqRows] = await pool.execute(
        `SELECT id, session_id, acs_task, question_text
         FROM session_questions
         WHERE id = ?
           AND session_id = ?
         LIMIT 1`,
        [sessionQuestionId, sessionId]
      );
      promptRow = (sqRows as any[])[0];
      if (!promptRow) {
        return Response.json({ error: "Session question not found" }, { status: 404 });
      }
    }

    let fallbackQuestion:
      | { id: string; acs_task_code: string; stem: string }
      | undefined;
    if (!promptRow || !promptRow.acs_task) {
      if (!baseQuestionId) {
        return Response.json(
          { error: "Unable to resolve question context for evaluation" },
          { status: 400 }
        );
      }
      const [qRows] = await pool.execute(
        `SELECT id, acs_task_code, stem
         FROM questions
         WHERE id = ?
         LIMIT 1`,
        [baseQuestionId]
      );
      fallbackQuestion = (qRows as any[])[0];
      if (!fallbackQuestion) {
        return Response.json({ error: "Question not found" }, { status: 404 });
      }
    }

    const acsTaskCode = promptRow?.acs_task || fallbackQuestion?.acs_task_code;
    const questionStem = promptRow?.question_text || fallbackQuestion?.stem;
    if (!acsTaskCode || !questionStem) {
      return Response.json(
        { error: "Unable to resolve question stem/task for evaluation" },
        { status: 400 }
      );
    }

    const [threadRowsRaw] = await pool.execute(
      `
      SELECT id, question_text, user_answer, ai_feedback, result, is_probe
      FROM session_questions
      WHERE session_id = ?
        AND acs_task = ?
        AND id <= ?
      ORDER BY id ASC
      `,
      [sessionId, acsTaskCode, Number(sessionQuestionId) || Number(promptRow?.id || 0)]
    );
    const threadRows = threadRowsRaw as Array<{
      id: number;
      question_text: string;
      user_answer: string | null;
      ai_feedback: string | null;
      result: EvaluationResultCode | null;
      is_probe: 0 | 1;
    }>;

    const priorFollowUps = threadRows
      .filter((row) => row.is_probe === 1)
      .map((row) => row.question_text.replace(/^Examiner Follow-Up:\s*/i, "").trim())
      .filter(Boolean);
    const escalationLevel = priorFollowUps.length;
    const escalationLimit = Math.max(2, Math.min(3, Number((session as any).max_probes_per_task || 3)));

    const parsedWeather = session.session_weather
      ? (() => {
          try {
            return typeof session.session_weather === "string"
              ? JSON.parse(session.session_weather)
              : session.session_weather;
          } catch (e) { console.error(`Failed to parse session_weather for session ${sessionId}:`, e); return null; }
        })()
      : null;

    const airportSource = session.airport_source as string | null;
    const schoolNote =
      airportSource === "school" && session.airport
        ? `\nNote: This student is training at ${session.airport} which is their flight school's primary training airport.`
        : "";

    const resolvedAirport = session.airport ?? parsedWeather?.airport ?? null;

    const weatherContext = parsedWeather
      ? {
          airport: resolvedAirport,
          aircraft: session.aircraft ?? parsedWeather.aircraft,
          wind: parsedWeather.wind,
          visibility: parsedWeather.visibility,
          ceiling: parsedWeather.ceiling,
          raw: parsedWeather.raw ? parsedWeather.raw + schoolNote : schoolNote || undefined,
        }
      : schoolNote
      ? { airport: resolvedAirport, aircraft: session.aircraft ?? null, raw: schoolNote }
      : null;

    const evalResult =
      (await evaluateWithOpenAI({
        questionStem,
        studentAnswer: answer,
        acsTaskCode,
        escalationLevel,
        priorFollowUps,
        priorThread: threadRows.map((row) => ({
          question: row.question_text,
          answer: row.user_answer,
          feedback: row.ai_feedback,
          result: row.result,
        })),
        weatherContext,
      })) || defaultEvaluation(acsTaskCode);

    let followUpQuestion =
      evalResult.probe_question && evalResult.probe_question.trim()
        ? evalResult.probe_question.trim()
        : buildFallbackFollowUp(questionStem, escalationLevel + 1, evalResult.missing_points);

    if (followUpQuestion) {
      const normalizedNew = normalizeText(followUpQuestion);
      const normalizedPrior = priorFollowUps.map(normalizeText);
      if (normalizedPrior.includes(normalizedNew)) {
        followUpQuestion = buildFallbackFollowUp(questionStem, escalationLevel + 1, evalResult.missing_points);
      }
    }

    const mastery = isMastery(evalResult);
    const exhaustedEscalations = !mastery && escalationLevel >= escalationLimit;
    const shouldAppendFollowUp =
      evalResult.result !== "PASS" &&
      !mastery &&
      !exhaustedEscalations &&
      !!followUpQuestion;
    const labeledFollowUp = shouldAppendFollowUp ? `Examiner Follow-Up: ${followUpQuestion}` : null;

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
        baseQuestionId || null,
        acsTaskCode,
        answer,
        evalResult.result,
        evalResult.missing_points.length,
        evalResult.result === "FAIL" ? 1 : 0,
        evalResult.confidence,
      ]
    );

    const delta = masteryDeltaFromEvaluation(evalResult);

    // Run user_skill upsert and session_questions update in parallel
    const updateSessionQuestionPromise = sessionQuestionId
      ? pool.execute(
          `
          UPDATE session_questions
          SET user_answer = ?,
              ai_feedback = ?,
              result = ?
          WHERE id = ?
            AND session_id = ?
          `,
          [answer, evalResult.feedback, evalResult.result, sessionQuestionId, sessionId]
        )
      : Promise.resolve(null);

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
          acsTaskCode,
          clamp(delta, 0, 5),
          evalResult.result === "PASS" ? 1 : 0,
          isNonPass(evalResult.result) ? 1 : 0,
          delta,
        ]
      ),
      updateSessionQuestionPromise,
    ]);

    if (shouldAppendFollowUp && labeledFollowUp) {
      await pool.execute(
        `
        INSERT INTO session_questions
          (session_id, question_id, acs_task, question_text, is_probe)
        VALUES
          (?, ?, ?, ?, 1)
        `,
        [sessionId, baseQuestionId || null, acsTaskCode, labeledFollowUp]
      );
    }

    const [countRows] = await pool.execute(
      `
      SELECT
        SUM(result='PASS') AS passCount,
        SUM(result='PROBE') AS probeCount,
        SUM(result='REMEDIATE') AS remediateCount,
        SUM(result='FAIL') AS failCount
      FROM session_questions
      WHERE session_id = ?
        AND result IS NOT NULL
      `,
      [sessionId]
    );
    const rawCounts = ((countRows as any[])[0] || {}) as {
      passCount?: number | null;
      probeCount?: number | null;
      remediateCount?: number | null;
      failCount?: number | null;
    };
    const counts = {
      passCount: Number(rawCounts.passCount || 0),
      probeCount: Number(rawCounts.probeCount || 0),
      remediateCount: Number(rawCounts.remediateCount || 0),
      failCount: Number(rawCounts.failCount || 0),
    };
    const overallGrade = computeOverallGrade(counts);
    const overallSummary = buildOverallSummary(counts);

    // Single UPDATE covering all session state fields
    await pool.execute(
      `
      UPDATE oral_sessions
      SET last_result = ?,
          last_feedback = ?,
          last_probe_question = ?,
          probe_count_for_task =
            CASE
              WHEN ? THEN LEAST(max_probes_per_task, probe_count_for_task + 1)
              ELSE 0
            END,
          current_acs_task_code = ?,
          current_question_id = ?,
          overall_grade = ?,
          overall_summary = ?
      WHERE id = ?
        AND user_id = ?
      `,
      [
        evalResult.result,
        evalResult.feedback,
        shouldAppendFollowUp ? followUpQuestion : null,
        shouldAppendFollowUp ? 1 : 0,
        acsTaskCode,
        baseQuestionId || session.current_question_id,
        overallGrade,
        overallSummary,
        sessionId,
        userId,
      ]
    );

    return Response.json({
      attemptId,
      ...evalResult,
      probe_question: shouldAppendFollowUp ? followUpQuestion : null,
      continue_thread: evalResult.result !== "PASS" && shouldAppendFollowUp,
      thread_status: mastery ? "mastery" : exhaustedEscalations ? "failed_after_escalation" : "continue",
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

