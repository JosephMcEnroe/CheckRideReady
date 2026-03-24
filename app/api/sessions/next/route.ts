// SCENARIO_QUESTION_RATIO env var controls what % of questions are
// AI-generated scenarios vs static question bank (default: 0.4 = 40%)
// Set to 0 to disable scenarios entirely, 1.0 for all scenarios
import { pool } from "@/lib/db";
import { buildOverallSummary, computeOverallGrade } from "@/lib/session-grading";
import { auth } from "@/auth";
import { generateScenarioQuestion } from "@/lib/scenario-generator";

const SCENARIO_RATIO = parseFloat(process.env.SCENARIO_QUESTION_RATIO || "0.4");

type Mode = "PPL" | "IR" | "CPL";

type SessionRow = {
  id: string;
  user_id: string;
  mode: Mode;
  status: "active" | "completed";
  recent_question_ids: unknown;
  probe_count_for_task: number;
  max_probes_per_task: number;
  current_question_id: string | null;
  current_acs_task_code: string | null;
  last_result: "PASS" | "PROBE" | "REMEDIATE" | "FAIL" | null;
  last_probe_question: string | null;
  session_weather: string | null;
  airport: string | null;
  aircraft: string | null;
  focus_areas: string | null;
};

type QuestionRow = {
  id: string;
  stem: string;
  acs_task_code: string;
  acs_area: string;
};

type PendingQuestionRow = {
  id: number;
  question_id: string | null;
  acs_task: string | null;
  question_text: string;
  is_probe: 0 | 1;
  acs_area: string | null;
};

type TxConnection = {
  beginTransaction: () => Promise<void>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
  release: () => void;
  execute: (sql: string, params?: unknown[]) => Promise<[unknown, unknown]>;
};

function dedupeStringArray(arr: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of arr) {
    if (typeof item !== "string" || !item) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

function parseRecentIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return dedupeStringArray(raw);
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return dedupeStringArray(parsed);
  } catch {
    return [];
  }
}

async function insertSessionQuestion(
  conn: TxConnection,
  args: {
    sessionId: string;
    questionId: string | null;
    acsTask: string | null;
    questionText: string;
    isProbe: boolean;
  }
) {
  const [result] = await conn.execute(
    `
    INSERT INTO session_questions
      (session_id, question_id, acs_task, question_text, is_probe)
    VALUES
      (?, ?, ?, ?, ?)
    `,
    [args.sessionId, args.questionId, args.acsTask, args.questionText, args.isProbe ? 1 : 0]
  );
  const insertId = (result as { insertId?: number }).insertId;
  if (!insertId) throw new Error("Failed to create session question row");
  return insertId;
}

async function markSessionCompleted(conn: TxConnection, sessionId: string, userId: string) {
  const [countRows] = await conn.execute(
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

  const rawCounts = ((countRows as unknown[])?.[0] || {}) as {
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

  await conn.execute(
    `
    UPDATE oral_sessions
    SET status = 'completed',
        ended_at = NOW(),
        current_question_id = NULL,
        current_acs_task_code = NULL,
        overall_grade = ?,
        overall_summary = ?
    WHERE id = ?
      AND user_id = ?
    `,
    [overallGrade, overallSummary, sessionId, userId]
  );
}

function buildQuestionFilter(
  mode: Mode,
  recentIds: string[],
  taskFilter: string | null
): { sql: string; params: unknown[] } {
  const modeJson = JSON.stringify(mode);
  let sql = `
    SELECT id, stem, acs_task_code, acs_area
    FROM questions
    WHERE JSON_CONTAINS(mode_tags, ?)
  `;
  const params: unknown[] = [modeJson];

  if (taskFilter) {
    sql += ` AND acs_task_code = ?`;
    params.push(taskFilter);
  }

  if (recentIds.length > 0) {
    const safeIds = recentIds.slice(-100); // cap at 100 to bound query size
    sql += ` AND id NOT IN (${safeIds.map(() => "?").join(",")})`;
    params.push(...safeIds);
  }

  sql += ` ORDER BY RAND() LIMIT 1`;
  return { sql, params };
}

export async function POST(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const sessionId = body?.sessionId as string | undefined;
  const forceNewBase = body?.forceNewBase === true;
  const useCurrentTaskFilter = body?.useCurrentTask === true;
  const taskFilter =
    typeof body?.taskFilter === "string" && body.taskFilter.trim()
      ? body.taskFilter.trim()
      : null;

  if (!sessionId) {
    return Response.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const maxQuestionsPerSession = Number(process.env.SESSION_MAX_QUESTIONS || 0) || 0;
  const conn = (await pool.getConnection()) as unknown as TxConnection;

  try {
    await conn.beginTransaction();

    const [sessionRows] = await conn.execute(
      `SELECT id, user_id, mode, status, recent_question_ids,
              probe_count_for_task, max_probes_per_task,
              current_question_id, current_acs_task_code,
              last_result, last_probe_question,
              session_weather, airport, aircraft, focus_areas
       FROM oral_sessions
       WHERE id = ?
         AND user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [sessionId, userId]
    );

    const session = (sessionRows as unknown[])[0] as SessionRow | undefined;

    if (!session) {
      await conn.rollback();
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (session.status === "completed") {
      await conn.commit();
      return Response.json({
        type: "SESSION_COMPLETE",
        sessionId,
        reason: "already_completed",
        redirectTo: `/sessions/${sessionId}/debrief`,
      });
    }

    const [pendingRows] = await conn.execute(
      `
      SELECT
        sq.id,
        sq.question_id,
        sq.acs_task,
        sq.question_text,
        sq.is_probe,
        q.acs_area
      FROM session_questions sq
      LEFT JOIN questions q ON q.id = sq.question_id
      WHERE sq.session_id = ?
        AND sq.result IS NULL
      ORDER BY sq.id ASC
      LIMIT 1
      `,
      [sessionId]
    );
    const pending = (pendingRows as unknown[])[0] as PendingQuestionRow | undefined;
    if (pending && !forceNewBase) {
      await conn.commit();
      return Response.json({
        type: "QUESTION",
        question: {
          id:
            pending.question_id ||
            `${session.current_question_id || "followup"}__probe_${pending.id}`,
          session_question_id: pending.id,
          stem: pending.question_text,
          acs_task_code: pending.acs_task,
          acs_area: pending.acs_area,
        },
        meta: { kind: pending.is_probe === 1 ? "probe" : "base" },
      });
    }

    if (pending && forceNewBase) {
      await conn.execute(
        `
        DELETE FROM session_questions
        WHERE session_id = ?
          AND result IS NULL
        `,
        [sessionId]
      );

      await conn.execute(
        `
        UPDATE oral_sessions
        SET probe_count_for_task = 0,
            last_probe_question = NULL,
            last_result = NULL
        WHERE id = ?
          AND user_id = ?
        `,
        [sessionId, userId]
      );
    }

    const recentIds = parseRecentIds(session.recent_question_ids || "[]");
    const askedCount = recentIds.length;

    const activeTaskFilter =
      taskFilter || (useCurrentTaskFilter ? session.current_acs_task_code : null) || null;
    const modeJson = JSON.stringify(session.mode);
    let poolCountSql = `
      SELECT COUNT(*) AS total
      FROM questions
      WHERE JSON_CONTAINS(mode_tags, ?)
    `;
    const poolCountParams: unknown[] = [modeJson];
    if (activeTaskFilter) {
      poolCountSql += ` AND acs_task_code = ?`;
      poolCountParams.push(activeTaskFilter);
    }

    const [poolRows] = await conn.execute(poolCountSql, poolCountParams);
    const poolCount = Number(((poolRows as unknown[])[0] as { total?: number })?.total || 0);

    const hitMaxQuestions =
      maxQuestionsPerSession > 0 && askedCount >= maxQuestionsPerSession;
    const exhaustedPool = askedCount >= poolCount;
    if (hitMaxQuestions || exhaustedPool || poolCount === 0) {
      await markSessionCompleted(conn, sessionId, userId);
      await conn.commit();
      return Response.json({
        type: "SESSION_COMPLETE",
        sessionId,
        reason: hitMaxQuestions ? "max_reached" : "no_more_new_questions",
        redirectTo: `/sessions/${sessionId}/debrief`,
      });
    }

    const shouldProbe =
      !forceNewBase &&
      (session.last_result === "PROBE" ||
        session.last_result === "REMEDIATE" ||
        session.last_result === "FAIL") &&
      session.probe_count_for_task > 0 &&
      session.probe_count_for_task <= session.max_probes_per_task &&
      !!session.current_question_id &&
      !!session.last_probe_question;

    if (shouldProbe) {
      const [baseRows] = await conn.execute(
        `SELECT id, acs_task_code, acs_area
         FROM questions
         WHERE id = ?
         LIMIT 1`,
        [session.current_question_id]
      );
      const baseQ = (baseRows as unknown[])[0] as
        | { id: string; acs_task_code: string; acs_area: string }
        | undefined;

      if (baseQ) {
        let probeText = session.last_probe_question!.trim();
        const [existingProbeRows] = await conn.execute(
          `
          SELECT id
          FROM session_questions
          WHERE session_id = ?
            AND question_text = ?
          LIMIT 1
          `,
          [sessionId, probeText]
        );
        if ((existingProbeRows as unknown[]).length > 0) {
          probeText = `${probeText} (refine with a different concrete example)`;
        }

        const sessionQuestionId = await insertSessionQuestion(conn, {
          sessionId,
          questionId: null,
          acsTask: baseQ.acs_task_code ?? null,
          questionText: probeText,
          isProbe: true,
        });

        await conn.commit();
        return Response.json({
          type: "QUESTION",
          question: {
            id: `${baseQ.id}__probe_${session.probe_count_for_task}`,
            session_question_id: sessionQuestionId,
            stem: probeText,
            acs_task_code: baseQ.acs_task_code,
            acs_area: `${baseQ.acs_area} (Probe)`,
          },
          meta: {
            kind: "probe",
            probeCount: session.probe_count_for_task,
            maxProbes: session.max_probes_per_task,
            baseQuestionId: baseQ.id,
          },
        });
      }
    }

    const useScenario =
      Math.random() < SCENARIO_RATIO &&
      !forceNewBase &&
      !!session.session_weather &&
      !!session.airport &&
      !!session.aircraft;

    if (useScenario) {
      const weatherData = session.session_weather
        ? JSON.parse(session.session_weather as string)
        : null;

      const focusAreas = session.focus_areas
        ? JSON.parse(session.focus_areas as string)
        : [];

      const [recentRows] = await conn.execute(
        "SELECT DISTINCT acs_task FROM session_questions WHERE session_id = ? AND acs_task IS NOT NULL ORDER BY id DESC LIMIT 5",
        [sessionId]
      );
      const recentTaskCodes = (recentRows as any[]).map((r) => r.acs_task);

      const scenario = await generateScenarioQuestion({
        airport: session.airport,
        aircraft: session.aircraft,
        mode: session.mode as "PPL" | "IR" | "CPL",
        weather: weatherData || {},
        focusAreas,
        recentTaskCodes,
      });

      if (scenario) {
        const sessionQuestionId = await insertSessionQuestion(conn, {
          sessionId,
          questionId: null,
          acsTask: scenario.acs_task_code,
          questionText: scenario.stem,
          isProbe: false,
        });

        await conn.execute(
          "UPDATE oral_sessions SET current_question_id = NULL, current_acs_task_code = ?, probe_count_for_task = 0 WHERE id = ? AND user_id = ?",
          [scenario.acs_task_code, sessionId, userId]
        );

        await conn.commit();
        return Response.json({
          type: "QUESTION",
          question: {
            id: `scenario_${sessionQuestionId}`,
            session_question_id: sessionQuestionId,
            stem: scenario.stem,
            acs_task_code: scenario.acs_task_code,
            acs_area: `${scenario.acs_area} (Live Scenario)`,
          },
          meta: { kind: "base", is_scenario: true },
        });
      }
      // scenario generation failed — fall through to static question below
    }

    const { sql: questionSql, params: questionParams } = buildQuestionFilter(
      session.mode,
      recentIds,
      activeTaskFilter
    );
    const [qRows] = await conn.execute(questionSql, questionParams);
    let question = (qRows as unknown[])[0] as QuestionRow | undefined;

    if (!question) {
      await markSessionCompleted(conn, sessionId, userId);
      await conn.commit();
      return Response.json({
        type: "SESSION_COMPLETE",
        sessionId,
        reason: "no_more_new_questions",
        redirectTo: `/sessions/${sessionId}/debrief`,
      });
    }

    const [dupeRows] = await conn.execute(
      `
      SELECT id
      FROM session_questions
      WHERE session_id = ?
        AND question_id = ?
      LIMIT 1
      `,
      [sessionId, question.id]
    );
    if ((dupeRows as unknown[]).length > 0) {
      const recentlyExcluded = [...recentIds, question.id];
      const { sql: secondSql, params: secondParams } = buildQuestionFilter(
        session.mode,
        recentlyExcluded,
        activeTaskFilter
      );
      const [secondRows] = await conn.execute(secondSql, secondParams);
      question = (secondRows as unknown[])[0] as QuestionRow | undefined;
      if (!question) {
        await markSessionCompleted(conn, sessionId, userId);
        await conn.commit();
        return Response.json({
          type: "SESSION_COMPLETE",
          sessionId,
          reason: "no_more_new_questions",
          redirectTo: `/sessions/${sessionId}/debrief`,
        });
      }
    }

    const updatedRecent = [...recentIds, question.id];
    await conn.execute(
      `
      UPDATE oral_sessions
      SET current_question_id = ?,
          current_acs_task_code = ?,
          probe_count_for_task = 0,
          recent_question_ids = ?
      WHERE id = ?
        AND user_id = ?
      `,
      [question.id, question.acs_task_code, JSON.stringify(updatedRecent), sessionId, userId]
    );

    const sessionQuestionId = await insertSessionQuestion(conn, {
      sessionId,
      questionId: question.id,
      acsTask: question.acs_task_code ?? null,
      questionText: question.stem,
      isProbe: false,
    });

    await conn.commit();
    return Response.json({
      type: "QUESTION",
      question: {
        id: question.id,
        session_question_id: sessionQuestionId,
        stem: question.stem,
        acs_task_code: question.acs_task_code,
        acs_area: question.acs_area,
      },
      meta: { kind: "base" },
    });
  } catch (err: unknown) {
    await conn.rollback();
    const e = err as { message?: string };
    return Response.json(
      { error: e?.message || "Failed to fetch next question" },
      { status: 500 }
    );
  } finally {
    conn.release();
  }
}

export async function GET() {
  return Response.json(
    { error: "Method not allowed. Use POST /api/sessions/next." },
    { status: 405 }
  );
}
