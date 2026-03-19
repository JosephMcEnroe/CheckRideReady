import { pool } from "@/lib/db";
import { auth } from "@/auth";

export async function POST(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { school_id, student_id, instructor_id } = body;

  if (!school_id || !student_id || !instructor_id) {
    return Response.json({ error: "Missing school_id, student_id, or instructor_id" }, { status: 400 });
  }

  // Verify caller is admin
  const [adminCheck] = await pool.execute(
    `SELECT id FROM school_members WHERE school_id = ? AND user_id = ? AND role = 'admin' LIMIT 1`,
    [school_id, userId]
  );
  if ((adminCheck as any[]).length === 0) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify student is a member with role student
  const [studentCheck] = await pool.execute(
    `SELECT id FROM school_members WHERE school_id = ? AND user_id = ? AND role = 'student' LIMIT 1`,
    [school_id, student_id]
  );
  if ((studentCheck as any[]).length === 0) {
    return Response.json({ error: "Student not found in school" }, { status: 404 });
  }

  // Verify instructor is a member with role instructor
  const [instructorCheck] = await pool.execute(
    `SELECT id FROM school_members WHERE school_id = ? AND user_id = ? AND role = 'instructor' LIMIT 1`,
    [school_id, instructor_id]
  );
  if ((instructorCheck as any[]).length === 0) {
    return Response.json({ error: "Instructor not found in school" }, { status: 404 });
  }

  // Upsert instructor_students
  const [existing] = await pool.execute(
    `SELECT id FROM instructor_students WHERE student_id = ? AND school_id = ? LIMIT 1`,
    [student_id, school_id]
  );

  if ((existing as any[]).length > 0) {
    await pool.execute(
      `UPDATE instructor_students SET instructor_id = ? WHERE student_id = ? AND school_id = ?`,
      [instructor_id, student_id, school_id]
    );
  } else {
    await pool.execute(
      `INSERT INTO instructor_students (id, school_id, instructor_id, student_id) VALUES (UUID(), ?, ?, ?)`,
      [school_id, instructor_id, student_id]
    );
  }

  return Response.json({ success: true });
}
