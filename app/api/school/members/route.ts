import { pool } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get("school_id");
  const roleFilter = searchParams.get("role");

  if (!schoolId) {
    return Response.json({ error: "Missing school_id" }, { status: 400 });
  }

  // Verify caller is a member of this school
  const [memberCheck] = await pool.execute(
    `SELECT id FROM school_members WHERE school_id = ? AND user_id = ? LIMIT 1`,
    [schoolId, userId]
  );
  if ((memberCheck as any[]).length === 0) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let sql = `SELECT sm.id, sm.user_id, sm.role, u.name, u.email
             FROM school_members sm
             JOIN users u ON u.id = sm.user_id
             WHERE sm.school_id = ?`;
  const params: unknown[] = [schoolId];

  if (roleFilter) {
    sql += ` AND sm.role = ?`;
    params.push(roleFilter);
  }

  const [rows] = await pool.execute(sql, params);
  return Response.json({ members: rows });
}
