import { pool } from "@/lib/db";
import { auth } from "@/auth";

export async function POST(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { session_id } = body;
  if (!session_id) return Response.json({ error: "Missing session_id" }, { status: 400 });

  // Verify caller owns this session
  const [sessionRows] = await pool.execute(
    `SELECT id FROM oral_sessions WHERE id = ? AND user_id = ? LIMIT 1`,
    [session_id, userId]
  );
  if ((sessionRows as any[]).length === 0) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  // Check if share token already exists
  const [existingRows] = await pool.execute(
    `SELECT token FROM share_tokens WHERE session_id = ? LIMIT 1`,
    [session_id]
  );
  if ((existingRows as any[]).length > 0) {
    const token = (existingRows as any[])[0].token;
    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    return Response.json({ shareUrl: `${appUrl}/debrief/share/${token}`, token });
  }

  const token = crypto.randomUUID();
  const id = crypto.randomUUID();
  await pool.execute(
    `INSERT INTO share_tokens (id, session_id, token, created_by) VALUES (?, ?, ?, ?)`,
    [id, session_id, token, userId]
  );

  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return Response.json({ shareUrl: `${appUrl}/debrief/share/${token}`, token });
}

export async function GET(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  if (!sessionId) return Response.json({ error: "Missing session_id" }, { status: 400 });

  const [rows] = await pool.execute(
    `SELECT token FROM share_tokens WHERE session_id = ? LIMIT 1`,
    [sessionId]
  );

  if ((rows as any[]).length === 0) {
    return Response.json({ exists: false });
  }

  const token = (rows as any[])[0].token;
  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return Response.json({ exists: true, shareUrl: `${appUrl}/debrief/share/${token}`, token });
}
