// MIGRATION REQUIRED:
// ALTER TABLE oral_sessions ADD COLUMN is_drill TINYINT(1) NOT NULL DEFAULT 0;
// ALTER TABLE oral_sessions ADD COLUMN drill_acs_task VARCHAR(64) NULL;
// ALTER TABLE oral_sessions ADD COLUMN drill_acs_area VARCHAR(100) NULL;
// ALTER TABLE oral_sessions ADD COLUMN drill_question_limit INT NOT NULL DEFAULT 10;

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
  const {
    acs_task_code,
    acs_area,
    mode: bodyMode,
  } = body as {
    acs_task_code?: string;
    acs_area?: string;
    mode?: string;
  };

  if (!acs_task_code || typeof acs_task_code !== "string" || !acs_task_code.trim()) {
    return Response.json({ error: "Missing acs_task_code" }, { status: 400 });
  }

  // Fetch user's certificate_goal, airport, aircraft for context
  const [userRows] = await pool.execute(
    `SELECT certificate_goal, airport, aircraft FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );
  const user = (userRows as unknown[])[0] as {
    certificate_goal?: string | null;
    airport?: string | null;
    aircraft?: string | null;
  } | undefined;

  const mode: Mode = isMode(bodyMode)
    ? bodyMode
    : isMode(user?.certificate_goal)
      ? (user!.certificate_goal as Mode)
      : "PPL";

  const airport = user?.airport ?? null;
  const aircraft = user?.aircraft ?? null;

  const sessionId = crypto.randomUUID();

  await pool.execute(
    `INSERT INTO oral_sessions
      (id, user_id, mode, status, current_acs_task_code,
       probe_count_for_task, max_probes_per_task, recent_question_ids,
       airport, aircraft,
       is_drill, drill_acs_task, drill_acs_area, drill_question_limit)
     VALUES
      (?, ?, ?, 'active', ?, 0, 1, JSON_ARRAY(), ?, ?, 1, ?, ?, 10)`,
    [
      sessionId,
      userId,
      mode,
      acs_task_code.trim(),
      airport,
      aircraft,
      acs_task_code.trim(),
      acs_area ?? null,
    ]
  );

  return Response.json({
    sessionId,
    drillArea: acs_area ?? null,
    drillTask: acs_task_code.trim(),
  });
}

export async function GET() {
  return Response.json(
    { error: "Method not allowed. Use POST /api/sessions/drill." },
    { status: 405 }
  );
}
