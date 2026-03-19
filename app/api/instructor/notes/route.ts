import { pool } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  const studentId = searchParams.get("student_id");

  if (!sessionId && !studentId) {
    return Response.json({ error: "Missing session_id or student_id" }, { status: 400 });
  }

  if (sessionId) {
    const [rows] = await pool.execute(
      `SELECT cn.id, cn.note_text, cn.created_at, u.name as instructor_name
       FROM cfi_notes cn
       JOIN users u ON u.id = cn.instructor_id
       WHERE cn.session_id = ?
       LIMIT 10`,
      [sessionId]
    );
    return Response.json({ notes: rows });
  }

  // student_id only
  const [rows] = await pool.execute(
    `SELECT cn.id, cn.note_text, cn.created_at, u.name as instructor_name
     FROM cfi_notes cn
     JOIN users u ON u.id = cn.instructor_id
     WHERE cn.student_id = ? AND cn.instructor_id = ?
     ORDER BY cn.created_at DESC`,
    [studentId, userId]
  );
  return Response.json({ notes: rows });
}

export async function POST(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { student_id, note_text, session_id } = body;

  if (!student_id || !note_text?.trim()) {
    return Response.json({ error: "Missing student_id or note_text" }, { status: 400 });
  }

  // Verify caller is assigned instructor for this student
  const [assignRows] = await pool.execute(
    `SELECT id FROM instructor_students WHERE instructor_id = ? AND student_id = ? LIMIT 1`,
    [userId, student_id]
  );
  if ((assignRows as any[]).length === 0) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // If session_id provided, verify it belongs to the student
  if (session_id) {
    const [sessRows] = await pool.execute(
      `SELECT id FROM oral_sessions WHERE id = ? AND user_id = ? LIMIT 1`,
      [session_id, student_id]
    );
    if ((sessRows as any[]).length === 0) {
      return Response.json({ error: "Session not found for this student" }, { status: 404 });
    }
  }

  const noteId = crypto.randomUUID();
  await pool.execute(
    `INSERT INTO cfi_notes (id, session_id, instructor_id, student_id, note_text) VALUES (?, ?, ?, ?, ?)`,
    [noteId, session_id || null, userId, student_id, note_text.trim()]
  );

  return Response.json({ success: true, noteId });
}

export async function PUT(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { note_id, note_text } = body;

  if (!note_id || !note_text?.trim()) {
    return Response.json({ error: "Missing note_id or note_text" }, { status: 400 });
  }

  const [noteRows] = await pool.execute(
    `SELECT id FROM cfi_notes WHERE id = ? AND instructor_id = ? LIMIT 1`,
    [note_id, userId]
  );
  if ((noteRows as any[]).length === 0) {
    return Response.json({ error: "Note not found" }, { status: 404 });
  }

  await pool.execute(
    `UPDATE cfi_notes SET note_text = ?, updated_at = NOW() WHERE id = ?`,
    [note_text.trim(), note_id]
  );

  return Response.json({ success: true });
}

export async function DELETE(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const noteId = searchParams.get("note_id");
  if (!noteId) return Response.json({ error: "Missing note_id" }, { status: 400 });

  const [noteRows] = await pool.execute(
    `SELECT id FROM cfi_notes WHERE id = ? AND instructor_id = ? LIMIT 1`,
    [noteId, userId]
  );
  if ((noteRows as any[]).length === 0) {
    return Response.json({ error: "Note not found" }, { status: 404 });
  }

  await pool.execute(`DELETE FROM cfi_notes WHERE id = ? AND instructor_id = ?`, [noteId, userId]);
  return Response.json({ success: true });
}
