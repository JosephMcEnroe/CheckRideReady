import { pool } from "@/lib/db";
import { auth } from "@/auth";

type Mode = "PPL" | "IR" | "CPL";

function isMode(v: unknown): v is Mode {
  return v === "PPL" || v === "IR" || v === "CPL";
}

export async function POST(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const mode = body?.mode;

  if (!isMode(mode)) {
    return Response.json(
      { error: "Invalid mode. Use PPL, IR, or CPL." },
      { status: 400 }
    );
  }

  const sessionId = crypto.randomUUID();

  await pool.execute(
    `INSERT INTO oral_sessions
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

