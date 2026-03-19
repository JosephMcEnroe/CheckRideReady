import { pool } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [rows] = await pool.execute(
    `SELECT s.id, s.name, s.icao_identifier, sm.role
     FROM schools s
     JOIN school_members sm ON sm.school_id = s.id
     WHERE sm.user_id = ?
     LIMIT 1`,
    [userId]
  );

  const school = (rows as any[])[0] || null;
  return Response.json({ school });
}
