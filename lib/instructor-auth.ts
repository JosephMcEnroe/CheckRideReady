import { pool } from "@/lib/db";

export async function getInstructorSchoolId(
  userId: string
): Promise<string | null> {
  const [rows] = await pool.execute(
    "SELECT school_id FROM school_members WHERE user_id = ? AND role = 'instructor' LIMIT 1",
    [userId]
  ) as any[];
  return (rows as any[])[0]?.school_id ?? null;
}
