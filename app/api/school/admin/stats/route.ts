import { pool } from "@/lib/db";
import { auth } from "@/auth";

async function getAdminSchoolId(userId: string, schoolIdParam: string | null): Promise<string | null> {
  if (schoolIdParam) {
    const [check] = await pool.execute(
      `SELECT id FROM school_members WHERE school_id = ? AND user_id = ? AND role = 'admin' LIMIT 1`,
      [schoolIdParam, userId]
    );
    return (check as any[]).length > 0 ? schoolIdParam : null;
  }
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
  const schoolId = await getAdminSchoolId(userId, searchParams.get("school_id"));
  if (!schoolId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const [[studentCountRow], [instructorCountRow], [sessionsRow], [scoreRow]] = await Promise.all([
    pool.execute(
      `SELECT COUNT(*) as count FROM school_members WHERE school_id = ? AND role = 'student'`,
      [schoolId]
    ),
    pool.execute(
      `SELECT COUNT(*) as count FROM school_members WHERE school_id = ? AND role = 'instructor'`,
      [schoolId]
    ),
    pool.execute(
      `SELECT COUNT(*) as count FROM oral_sessions os
       JOIN school_members sm ON sm.user_id = os.user_id AND sm.school_id = ?
       WHERE os.started_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [schoolId]
    ),
    pool.execute(
      `SELECT ROUND(AVG(
        CASE sq.result
          WHEN 'PASS' THEN 100
          WHEN 'PROBE' THEN 70
          WHEN 'REMEDIATE' THEN 40
          WHEN 'FAIL' THEN 0
          ELSE NULL
        END
      )) as avg_score
      FROM session_questions sq
      JOIN oral_sessions os ON os.id = sq.session_id
      JOIN school_members sm ON sm.user_id = os.user_id AND sm.school_id = ?
      WHERE sq.result IS NOT NULL`,
      [schoolId]
    ),
  ]);

  return Response.json({
    totalStudents: Number((studentCountRow as any[])[0]?.count || 0),
    totalInstructors: Number((instructorCountRow as any[])[0]?.count || 0),
    sessionsThisWeek: Number((sessionsRow as any[])[0]?.count || 0),
    avgScore: Number((scoreRow as any[])[0]?.avg_score || 0),
  });
}
