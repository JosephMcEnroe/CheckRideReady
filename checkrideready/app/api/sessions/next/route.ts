import { pool } from "@/lib/db";

type Mode = "PPL" | "IR" | "CPL";

function getUserId(): string {
  return "demo-user";
}

type SessionRow = {
  id: string;
  user_id: string;
  mode: Mode;
  status: "active" | "completed";
  recent_question_ids: string;
  probe_count_for_task: number;
  max_probes_per_task: number;
  current_question_id: string | null;
  current_acs_task_code: string | null;
  last_result: "PASS" | "PROBE" | "REMEDIATE" | "FAIL" | null;
  last_feedback: string | null;
  last_probe_question: string | null;
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sessionId = body?.sessionId as string | undefined;
  const forceNewBase = body?.forceNewBase === true;

  if (!sessionId) {
    return Response.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const userId = getUserId();

  const [sessionRows] = await pool.execute(
    `SELECT id, user_id, mode, status, recent_question_ids,
            probe_count_for_task, max_probes_per_task,
            current_question_id, current_acs_task_code,
            last_result, last_feedback, last_probe_question
     FROM sessions
     WHERE id = ?
     LIMIT 1`,
    [sessionId]
  );

  const session = (sessionRows as any[])[0] as SessionRow | undefined;

  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
  if (session.user_id !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (session.status !== "active") {
    return Response.json({ error: "Session is not active" }, { status: 400 });
  }

  let recentIds: string[] = [];
  try {
    recentIds = JSON.parse(session.recent_question_ids || "[]");
    if (!Array.isArray(recentIds)) recentIds = [];
  } catch {
    recentIds = [];
  }

  const shouldProbe =
    !forceNewBase &&
    (session.last_result === "PROBE" ||
      session.last_result === "REMEDIATE" ||
      session.last_result === "FAIL") &&
    session.probe_count_for_task > 0 &&
    session.probe_count_for_task <= session.max_probes_per_task &&
    session.current_question_id;

  if (shouldProbe && session.last_probe_question) {
    const [baseRows] = await pool.execute(
      `SELECT id, acs_task_code, acs_area
       FROM questions
       WHERE id = ?
       LIMIT 1`,
      [session.current_question_id]
    );

    const baseQ = (baseRows as any[])[0];
    if (baseQ) {
      return Response.json({
        question: {
          id: `${baseQ.id}__probe_${session.probe_count_for_task}`,
          stem: session.last_probe_question,
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

  const mode = session.mode;
  const modeJson = JSON.stringify(mode);

  let questionQuery = `
    SELECT id, stem, acs_task_code, acs_area
    FROM questions
    WHERE JSON_CONTAINS(mode_tags, ?)
  `;
  const params: any[] = [modeJson];

  if (recentIds.length > 0) {
    const placeholders = recentIds.map(() => "?").join(",");
    questionQuery += ` AND id NOT IN (${placeholders})`;
    params.push(...recentIds);
  }

  questionQuery += ` ORDER BY RAND() LIMIT 1`;

  const [qRows] = await pool.execute(questionQuery, params);
  let question = (qRows as any[])[0] as any | undefined;

  if (!question) {
    const [fallbackRows] = await pool.execute(
      `
      SELECT id, stem, acs_task_code, acs_area
      FROM questions
      WHERE JSON_CONTAINS(mode_tags, ?)
      ORDER BY RAND()
      LIMIT 1
      `,
      [modeJson]
    );
    question = (fallbackRows as any[])[0];
  }

  if (!question) {
    return Response.json(
      { error: `No questions found for mode ${mode}` },
      { status: 404 }
    );
  }

  const newRecent = [question.id, ...recentIds.filter((x) => x !== question.id)].slice(0, 10);

  await pool.execute(
    `
    UPDATE sessions
    SET current_question_id = ?,
        current_acs_task_code = ?,
        probe_count_for_task = 0,
        recent_question_ids = ?
    WHERE id = ?
    `,
    [question.id, question.acs_task_code, JSON.stringify(newRecent), sessionId]
  );

  return Response.json({
    question: {
      id: question.id,
      stem: question.stem,
      acs_task_code: question.acs_task_code,
      acs_area: question.acs_area,
    },
    meta: { kind: "base" },
  });
}

export async function GET() {
  return Response.json(
    { error: "Method not allowed. Use POST /api/sessions/next." },
    { status: 405 }
  );
}
