import { pool } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [[userRows], [schoolRows]] = await Promise.all([
    pool.execute(
      `SELECT home_airport, aircraft_type, certificate_goal FROM users WHERE id = ? LIMIT 1`,
      [userId]
    ),
    pool.execute(
      `SELECT s.icao_identifier, s.name, sm.role
       FROM school_members sm
       JOIN schools s ON s.id = sm.school_id
       WHERE sm.user_id = ?
       LIMIT 1`,
      [userId]
    ),
  ]);

  const user = (userRows as any[])[0] as {
    home_airport: string | null;
    aircraft_type: string | null;
    certificate_goal: string | null;
  } | undefined;

  const school = (schoolRows as any[])[0] as {
    icao_identifier: string | null;
    name: string | null;
    role: string | null;
  } | undefined;

  const schoolIcao = school?.icao_identifier ?? null;
  const schoolIsSource = !!(schoolIcao);
  const effectiveAirport = schoolIcao ?? user?.home_airport ?? null;

  return Response.json({
    user: {
      home_airport: user?.home_airport ?? null,
      aircraft_type: user?.aircraft_type ?? null,
      certificate_goal: user?.certificate_goal ?? null,
    },
    school: school
      ? {
          icao_identifier: school.icao_identifier,
          name: school.name,
          role: school.role,
        }
      : null,
    effective_airport: effectiveAirport,
    school_is_source: schoolIsSource,
  });
}
