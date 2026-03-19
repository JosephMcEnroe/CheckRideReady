import { pool } from "@/lib/db";
import { auth } from "@/auth";

async function getAdminSchoolId(userId: string): Promise<string | null> {
  const [rows] = await pool.execute(
    `SELECT school_id FROM school_members WHERE user_id = ? AND role = 'admin' LIMIT 1`,
    [userId]
  );
  return (rows as any[])[0]?.school_id || null;
}

export async function GET(_req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const schoolId = await getAdminSchoolId(userId);
  if (!schoolId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const [[schoolRows], [memberRows]] = await Promise.all([
    pool.execute(`SELECT id, name, icao_identifier FROM schools WHERE id = ? LIMIT 1`, [schoolId]),
    pool.execute(
      `SELECT sm.id, sm.user_id, sm.role, sm.created_at, u.name, u.email
       FROM school_members sm
       JOIN users u ON u.id = sm.user_id
       WHERE sm.school_id = ?
       ORDER BY FIELD(sm.role, 'admin', 'instructor', 'student'), u.name`,
      [schoolId]
    ),
  ]);

  const school = (schoolRows as any[])[0];
  if (!school) return Response.json({ error: "School not found" }, { status: 404 });

  return Response.json({ school, members: memberRows, currentUserId: userId });
}

export async function PATCH(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const schoolId = await getAdminSchoolId(userId);
  if (!schoolId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { member_id, role } = body;

  if (!member_id || !role) return Response.json({ error: "Missing member_id or role" }, { status: 400 });
  if (!["admin", "instructor", "student"].includes(role)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }

  // Look up the member
  const [memberRows] = await pool.execute(
    `SELECT user_id, role FROM school_members WHERE id = ? AND school_id = ? LIMIT 1`,
    [member_id, schoolId]
  );
  const member = (memberRows as any[])[0];
  if (!member) return Response.json({ error: "Member not found" }, { status: 404 });

  if (member.user_id === userId) {
    return Response.json({ error: "Cannot change your own role" }, { status: 403 });
  }
  if (member.role === "admin") {
    return Response.json({ error: "Cannot change another admin's role" }, { status: 403 });
  }

  await pool.execute(
    `UPDATE school_members SET role = ? WHERE id = ? AND school_id = ?`,
    [role, member_id, schoolId]
  );

  return Response.json({ success: true });
}

export async function DELETE(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const schoolId = await getAdminSchoolId(userId);
  if (!schoolId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("member_id");
  if (!memberId) return Response.json({ error: "Missing member_id" }, { status: 400 });

  // Look up the member
  const [memberRows] = await pool.execute(
    `SELECT user_id, role FROM school_members WHERE id = ? AND school_id = ? LIMIT 1`,
    [memberId, schoolId]
  );
  const member = (memberRows as any[])[0];
  if (!member) return Response.json({ error: "Member not found" }, { status: 404 });

  if (member.user_id === userId) {
    return Response.json({ error: "Cannot remove yourself" }, { status: 403 });
  }
  if (member.role === "admin") {
    return Response.json({ error: "Cannot remove another admin" }, { status: 403 });
  }

  await pool.execute(`DELETE FROM school_members WHERE id = ? AND school_id = ?`, [memberId, schoolId]);
  await pool.execute(
    `DELETE FROM instructor_students WHERE (student_id = ? OR instructor_id = ?) AND school_id = ?`,
    [member.user_id, member.user_id, schoolId]
  );

  return Response.json({ success: true });
}
