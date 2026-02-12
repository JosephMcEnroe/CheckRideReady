import { pool } from "@/lib/db";

type Mode = "PPL" | "IR" | "CPL";

function isMode(v: unknown): v is Mode {
  return v === "PPL" || v === "IR" || v === "CPL";
}

function getUserId(): string {
  return "demo-user";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const mode = body?.mode;

  if (!isMode(mode)) {
    return Response.json(
      { error: "Invalid mode. Use PPL, IR, or CPL." },
      { status: 400 }
    );
  }

  const sessionId = crypto.randomUUID();
  const userId = getUserId();

  await pool.execute(
    `INSERT INTO sessions
      (id, user_id, mode, status, probe_count_for_task, max_probes_per_task, recent_question_ids)
     VALUES
      (?, ?, ?, 'active', 0, 2, JSON_ARRAY())`,
    [sessionId, userId, mode]
  );

  return Response.json({ sessionId });
}

export async function GET() {
  return Response.json(
    { error: "Method not allowed. Use POST /api/sessions/start." },
    { status: 405 }
  );
}
