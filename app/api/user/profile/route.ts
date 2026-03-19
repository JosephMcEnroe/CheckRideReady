import { pool } from "@/lib/db";
import { auth } from "@/auth";

const VALID_GOALS = ["PPL", "IR", "CPL"] as const;

export async function GET() {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [rows] = await pool.execute(
    `SELECT home_airport, aircraft_type, certificate_goal FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );
  const user = (rows as any[])[0];

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json({
    home_airport: user.home_airport ?? null,
    aircraft_type: user.aircraft_type ?? null,
    certificate_goal: user.certificate_goal ?? null,
  });
}

export async function POST(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  const home_airport = body?.home_airport ?? null;
  const aircraft_type = body?.aircraft_type ?? null;
  const certificate_goal = body?.certificate_goal ?? null;

  // Validate certificate_goal
  if (certificate_goal !== null && !VALID_GOALS.includes(certificate_goal)) {
    return Response.json(
      { error: "certificate_goal must be PPL, IR, CPL, or null" },
      { status: 400 }
    );
  }

  // Validate home_airport
  if (home_airport !== null) {
    if (typeof home_airport !== "string" || home_airport.length > 4 || !/^[A-Za-z0-9]+$/.test(home_airport)) {
      return Response.json(
        { error: "home_airport must be a max 4-char alphanumeric string" },
        { status: 400 }
      );
    }
  }

  await pool.execute(
    `UPDATE users SET home_airport = ?, aircraft_type = ?, certificate_goal = ? WHERE id = ?`,
    [home_airport, aircraft_type, certificate_goal, userId]
  );

  return Response.json({ success: true });
}
