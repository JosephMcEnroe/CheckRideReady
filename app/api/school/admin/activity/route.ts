import { pool } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(req: Request) {
  const authSession = await auth();
  const userId = (authSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let schoolId = searchParams.get("school_id");

  if (!schoolId) {
    const [rows] = await pool.execute(
      `SELECT school_id FROM school_members WHERE user_id = ? AND role IN ('admin', 'instructor') LIMIT 1`,
      [userId]
    );
    schoolId = (rows as any[])[0]?.school_id || null;
  }

  if (!schoolId) return Response.json({ error: "Forbidden" }, { status: 403 });

  // Verify caller is admin or instructor
  const [memberCheck] = await pool.execute(
    `SELECT id FROM school_members WHERE school_id = ? AND user_id = ? AND role IN ('admin', 'instructor') LIMIT 1`,
    [schoolId, userId]
  );
  if ((memberCheck as any[]).length === 0) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [rows] = await pool.execute(
    `SELECT
      os.id,
      os.mode,
      os.overall_grade,
      os.started_at,
      u.name as student_name,
      ROUND(AVG(
        CASE sq.result
          WHEN 'PASS' THEN 100
          WHEN 'PROBE' THEN 70
          WHEN 'REMEDIATE' THEN 40
          WHEN 'FAIL' THEN 0
          ELSE NULL
        END
      )) as score
    FROM oral_sessions os
    JOIN users u ON u.id = os.user_id
    JOIN school_members sm ON sm.user_id = os.user_id AND sm.school_id = ?
    LEFT JOIN session_questions sq ON sq.session_id = os.id AND sq.result IS NOT NULL
    WHERE os.overall_grade IS NOT NULL
    GROUP BY os.id, os.mode, os.overall_grade, os.started_at, u.name
    ORDER BY os.started_at DESC
    LIMIT 20`,
    [schoolId]
  );

  return Response.json({ activity: rows });
}
