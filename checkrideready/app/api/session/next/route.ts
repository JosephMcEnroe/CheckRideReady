import { pool } from "@/lib/db";

type Mode = "PPL" | "IR" | "CPL";

function getUserId(): string {
  // MVP placeholder. Replace with real auth later.
  return "demo-user";
}

type SessionRow = {
  id: string;
  user_id: string;
  mode: Mode;
  status: "active" | "completed";
  recent_question_ids: string; // JSON string
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sessionId = body?.sessionId as string | undefined;

  if (!sessionId) {
    return Response.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const userId = getUserId();

  // 1) Load session
  const [sessionRows] = await pool.execute(
    `SELECT id, user_id, mode, status, recent_question_ids
     FROM sessions
     WHERE id = ?
     LIMIT 1`,
    [sessionId]
  );

  const session = (sessionRows as any[])[0] as SessionRow | undefined;

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.user_id !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session.status !== "active") {
    return Response.json({ error: "Session is not active" }, { status: 400 });
  }

  // 2) Build exclusion list from recent_question_ids JSON
  let recentIds: string[] = [];
  try {
    recentIds = JSON.parse(session.recent_question_ids || "[]");
    if (!Array.isArray(recentIds)) recentIds = [];
  } catch {
    recentIds = [];
  }

  // 3) Select a random question for this mode (avoid recent)
  // Mode tags stored as JSON array; JSON_CONTAINS(mode_tags, '"PPL"') works.
  const mode = session.mode;
  const modeJson = JSON.stringify(mode); // => "\"PPL\"" (a JSON string literal)

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

  // 4) If we excluded too many and got nothing, allow repeats (fallback)
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

  // 5) Update session: set current question + ACS code, reset probe count, update recent list
  // Keep last 10 recents
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

  // 6) Return the question to the client
  return Response.json({
    question: {
      id: question.id,
      stem: question.stem,
      acs_task_code: question.acs_task_code,
      acs_area: question.acs_area,
    },
  });
}
