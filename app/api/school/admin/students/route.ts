import { pool } from "@/lib/db";
import { auth } from "@/auth";

async function getSchoolId(userId: string, schoolIdParam: string | null): Promise<string | null> {
  if (schoolIdParam) return schoolIdParam;
  const [rows] = await pool.execute(
    `SELECT school_id FROM school_members WHERE user_id = ? AND role = 'admin' LIMIT 1`,
    [userId]
  );
  return (rows as any[])[0]?.school_id || null;
}

export async function GET(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const schoolIdParam = searchParams.get("school_id");

  const schoolId = await getSchoolId(userId, schoolIdParam);
  if (!schoolId) return Response.json({ error: "School not found" }, { status: 404 });

  const [adminCheck] = await pool.execute(
    `SELECT id FROM school_members WHERE school_id = ? AND user_id = ? AND role = 'admin' LIMIT 1`,
    [schoolId, userId]
  );
  if ((adminCheck as any[]).length === 0) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [rows] = await pool.execute(
    `SELECT
      u.id,
      sm.id as member_id,
      u.name,
      u.email,
      u.certificate_goal,
      sm.created_at as joined_at,
      ist.instructor_id,
      inst_user.name as instructor_name,
      latest.last_session_date,
      latest.last_result,
      latest.session_count,
      latest.avg_score
    FROM school_members sm
    JOIN users u ON u.id = sm.user_id
    LEFT JOIN instructor_students ist ON ist.student_id = u.id AND ist.school_id = sm.school_id
    LEFT JOIN users inst_user ON inst_user.id = ist.instructor_id
    LEFT JOIN (
      SELECT
        os.user_id,
        MAX(os.started_at) as last_session_date,
        COUNT(*) as session_count,
        MAX(os.overall_grade) as last_result,
        ROUND(AVG(
          CASE sq.result
            WHEN 'PASS' THEN 100
            WHEN 'PROBE' THEN 70
            WHEN 'REMEDIATE' THEN 40
            WHEN 'FAIL' THEN 0
            ELSE NULL
          END
        )) as avg_score
      FROM oral_sessions os
      LEFT JOIN session_questions sq ON sq.session_id = os.id
      GROUP BY os.user_id
    ) latest ON latest.user_id = u.id
    WHERE sm.school_id = ?
      AND sm.role = 'student'
    ORDER BY sm.created_at DESC`,
    [schoolId]
  );

  return Response.json({ students: rows, schoolId });
}
