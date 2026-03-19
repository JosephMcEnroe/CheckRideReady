import { pool } from "@/lib/db";
import { auth } from "@/auth";
import { sendInviteEmail } from "@/lib/email";

function toMySQLDatetime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export async function POST(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { school_id, email, role, assign_instructor_id, cert_track, message: _message } = body;

  if (!school_id) return Response.json({ error: "Missing school_id" }, { status: 400 });
  if (!email || !email.includes("@")) return Response.json({ error: "Valid email required" }, { status: 400 });
  if (role !== "instructor" && role !== "student") {
    return Response.json({ error: "Role must be instructor or student" }, { status: 400 });
  }

  // Verify caller is admin or instructor in this school
  const [callerRows] = await pool.execute(
    `SELECT id, role FROM school_members WHERE school_id = ? AND user_id = ? AND role IN ('admin', 'instructor') LIMIT 1`,
    [school_id, userId]
  );
  const caller = (callerRows as any[])[0];
  if (!caller) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Instructors can only invite students
  if (caller.role === "instructor" && role !== "student") {
    return Response.json({ error: "Instructors can only invite students" }, { status: 403 });
  }

  // Check for existing pending invite
  const [existingRows] = await pool.execute(
    `SELECT id FROM school_invites WHERE school_id = ? AND email = ? AND accepted_at IS NULL LIMIT 1`,
    [school_id, email]
  );
  if ((existingRows as any[]).length > 0) {
    return Response.json({ error: "Invite already sent to this email" }, { status: 400 });
  }

  // Fetch school name
  const [schoolRows] = await pool.execute(`SELECT name FROM schools WHERE id = ? LIMIT 1`, [school_id]);
  const school = (schoolRows as any[])[0];
  if (!school) return Response.json({ error: "School not found" }, { status: 404 });

  // Fetch caller info
  const [userRows] = await pool.execute(`SELECT name, email FROM users WHERE id = ? LIMIT 1`, [userId]);
  const callerUser = (userRows as any[])[0];

  const token = crypto.randomUUID();
  const expiresAt = toMySQLDatetime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const inviteId = crypto.randomUUID();

  // If caller is instructor, auto-assign themselves
  const effectiveInstructorId = caller.role === "instructor" ? userId : (assign_instructor_id || null);

  await pool.execute(
    `INSERT INTO school_invites (id, school_id, email, role, invited_by, token, expires_at, assigned_instructor_id, cert_track)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      inviteId,
      school_id,
      email,
      role,
      userId,
      token,
      expiresAt,
      effectiveInstructorId,
      cert_track || null,
    ]
  );

  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const inviteUrl = `${appUrl}/invite/${token}`;
  console.log("INVITE URL:", inviteUrl);

  try {
    await sendInviteEmail({
      to: email,
      invitedBy: callerUser?.name || callerUser?.email || "Your school admin",
      schoolName: school.name,
      role,
      inviteUrl,
    });
  } catch (emailErr) {
    console.warn("Failed to send invite email:", emailErr);
  }

  return Response.json({ success: true, inviteUrl, token });
}

export async function GET(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const schoolId = searchParams.get("school_id");
  if (!schoolId) return Response.json({ error: "Missing school_id" }, { status: 400 });

  // Verify caller is a member
  const [memberCheck] = await pool.execute(
    `SELECT id FROM school_members WHERE school_id = ? AND user_id = ? LIMIT 1`,
    [schoolId, userId]
  );
  if ((memberCheck as any[]).length === 0) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [rows] = await pool.execute(
    `SELECT si.id, si.email, si.role, si.cert_track, si.created_at, si.expires_at, u.name as inviter_name
     FROM school_invites si
     LEFT JOIN users u ON u.id = si.invited_by
     WHERE si.school_id = ? AND si.accepted_at IS NULL
     ORDER BY si.created_at DESC`,
    [schoolId]
  );

  return Response.json({ invites: rows });
}
