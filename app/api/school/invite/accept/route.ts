import { pool } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return Response.json({ valid: false, reason: "Missing token" });

  const [rows] = await pool.execute(
    `SELECT si.id, si.school_id, si.email, si.role, si.expires_at,
            s.name as school_name, u.name as inviter_name
     FROM school_invites si
     JOIN schools s ON s.id = si.school_id
     LEFT JOIN users u ON u.id = si.invited_by
     WHERE si.token = ? AND si.accepted_at IS NULL
     LIMIT 1`,
    [token]
  );

  const invite = (rows as any[])[0];
  if (!invite) {
    return Response.json({ valid: false, reason: "Invite not found or already accepted" });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return Response.json({ valid: false, reason: "This invite has expired" });
  }

  return Response.json({
    valid: true,
    schoolName: invite.school_name,
    role: invite.role,
    inviterName: invite.inviter_name,
    email: invite.email,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { token } = body;
  if (!token) return Response.json({ error: "Missing token" }, { status: 400 });

  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;

  // Not logged in — tell frontend to redirect to login
  if (!userId) {
    return Response.json({ requiresAuth: true, token }, { status: 200 });
  }

  try {
    const [inviteRows] = await pool.execute(
      `SELECT * FROM school_invites WHERE token = ? AND accepted_at IS NULL LIMIT 1`,
      [token]
    );
    const invite = (inviteRows as any[])[0];
    if (!invite) {
      return Response.json({ error: "Invite not found or expired" }, { status: 404 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return Response.json({ error: "This invite has expired" }, { status: 400 });
    }

    // Verify logged in user's email matches the invite email
    const [userRows] = await pool.execute(
      "SELECT email FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    const userEmail = (userRows as any[])[0]?.email;

    if (userEmail && invite.email &&
        userEmail.toLowerCase() !== invite.email.toLowerCase()) {
      return Response.json({
        error: `This invite was sent to ${invite.email}. Please sign out and sign in with that email address to accept.`,
        wrongAccount: true,
        inviteEmail: invite.email,
      }, { status: 403 });
    }

    // Check not already a member
    const [memberCheck] = await pool.execute(
      `SELECT id FROM school_members WHERE school_id = ? AND user_id = ? LIMIT 1`,
      [invite.school_id, userId]
    );
    if ((memberCheck as any[]).length > 0) {
      return Response.json({ error: "Already a member of this school" }, { status: 400 });
    }

    await pool.execute(
      `INSERT INTO school_members (id, school_id, user_id, role) VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), invite.school_id, userId, invite.role]
    );

    // If student and has assigned instructor, link them
    if (invite.role === "student" && invite.assigned_instructor_id) {
      await pool.execute(
        `INSERT INTO instructor_students (id, school_id, instructor_id, student_id) VALUES (?, ?, ?, ?)`,
        [crypto.randomUUID(), invite.school_id, invite.assigned_instructor_id, userId]
      );
    }

    await pool.execute(
      `UPDATE school_invites SET accepted_at = NOW() WHERE token = ?`,
      [token]
    );

    return Response.json({ success: true, schoolId: invite.school_id, role: invite.role });
  } catch (err: unknown) {
    console.error("Invite accept error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to accept invite" },
      { status: 500 }
    );
  }
}
