// MIGRATION REQUIRED — run this in Railway before deploying:
// ALTER TABLE oral_sessions ADD COLUMN airport VARCHAR(10) NULL;
// ALTER TABLE oral_sessions ADD COLUMN aircraft VARCHAR(50) NULL;
// ALTER TABLE oral_sessions ADD COLUMN focus_areas JSON NULL;
// ALTER TABLE oral_sessions ADD COLUMN session_weather JSON NULL;
// MIGRATION: ALTER TABLE oral_sessions ADD COLUMN airport_source ENUM('school','personal','custom') NULL;

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

  const airport =
    typeof body?.airport === "string" && body.airport.trim()
      ? body.airport.trim().slice(0, 10)
      : null;

  const aircraft =
    typeof body?.aircraft === "string" && body.aircraft.trim()
      ? body.aircraft.trim().slice(0, 50)
      : null;

  const focusAreas =
    Array.isArray(body?.focusAreas) && body.focusAreas.length > 0
      ? JSON.stringify(body.focusAreas.filter((a: unknown) => typeof a === "string"))
      : null;

  const weatherObj = body?.weather && typeof body.weather === "object" ? body.weather : null;
  const sessionWeather = weatherObj ? JSON.stringify(weatherObj) : null;

  const airportSourceRaw = body?.airport_source;
  const airportSource =
    airportSourceRaw === "school" || airportSourceRaw === "personal" || airportSourceRaw === "custom"
      ? airportSourceRaw
      : null;

  const sessionId = crypto.randomUUID();

  await pool.execute(
    `INSERT INTO oral_sessions
      (id, user_id, mode, status, probe_count_for_task, max_probes_per_task, recent_question_ids, airport, aircraft, focus_areas, session_weather, airport_source)
     VALUES
      (?, ?, ?, 'active', 0, 2, JSON_ARRAY(), ?, ?, ?, ?, ?)`,
    [sessionId, userId, mode, airport, aircraft, focusAreas, sessionWeather, airportSource]
  );

  return Response.json({ sessionId });
}

export async function GET() {
  return Response.json(
    { error: "Method not allowed. Use POST /api/sessions/start." },
    { status: 405 }
  );
}
