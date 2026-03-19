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
  const { invite_id } = body;
  if (!invite_id) return Response.json({ error: "Missing invite_id" }, { status: 400 });

  const [inviteRows] = await pool.execute(
    `SELECT si.*, s.name as school_name
     FROM school_invites si
     JOIN schools s ON s.id = si.school_id
     WHERE si.id = ? LIMIT 1`,
    [invite_id]
  );
  const invite = (inviteRows as any[])[0];
  if (!invite) return Response.json({ error: "Invite not found" }, { status: 404 });

  // Verify caller is admin of that school
  const [memberCheck] = await pool.execute(
    `SELECT role FROM school_members WHERE school_id = ? AND user_id = ? LIMIT 1`,
    [invite.school_id, userId]
  );
  const member = (memberCheck as any[])[0];
  if (!member || member.role !== "admin") {
    return Response.json({ error: "Forbidden — must be school admin" }, { status: 403 });
  }

  const newExpiresAt = toMySQLDatetime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  await pool.execute(`UPDATE school_invites SET expires_at = ? WHERE id = ?`, [newExpiresAt, invite_id]);

  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const inviteUrl = `${appUrl}/invite/${invite.token}`;

  const [userRows] = await pool.execute(`SELECT name, email FROM users WHERE id = ? LIMIT 1`, [userId]);
  const callerUser = (userRows as any[])[0];

  await sendInviteEmail({
    to: invite.email,
    invitedBy: callerUser?.name || callerUser?.email || "Your school admin",
    schoolName: invite.school_name,
    role: invite.role,
    inviteUrl,
  });

  return Response.json({ success: true, inviteUrl });
}
