import { pool } from "@/lib/db";
import { auth } from "@/auth";

export async function POST(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, icao_identifier, role, tracks } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 191) {
    return Response.json({ error: "School name is required (max 191 chars)" }, { status: 400 });
  }

  if (icao_identifier && (typeof icao_identifier !== "string" || icao_identifier.length < 3 || icao_identifier.length > 4 || !/^[A-Za-z0-9]+$/.test(icao_identifier))) {
    return Response.json({ error: "ICAO identifier must be 3-4 alphanumeric characters" }, { status: 400 });
  }

  if (!role || (role !== "admin" && role !== "cfi")) {
    return Response.json({ error: "Role must be admin or cfi" }, { status: 400 });
  }

  const schoolId = crypto.randomUUID();
  const memberId = crypto.randomUUID();

  await pool.execute(
    `INSERT INTO schools (id, name, icao_identifier, created_by) VALUES (?, ?, ?, ?)`,
    [schoolId, name.trim(), icao_identifier?.toUpperCase() || null, userId]
  );

  await pool.execute(
    `INSERT INTO school_members (id, school_id, user_id, role) VALUES (?, ?, ?, 'admin')`,
    [memberId, schoolId, userId]
  );

  return Response.json({ schoolId, success: true });
}
