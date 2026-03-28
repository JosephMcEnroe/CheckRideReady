-- Performance indexes for frequently queried columns

-- oral_sessions: queried by user_id on almost every page; started_at used for ordering/filtering
CREATE INDEX IF NOT EXISTS idx_oral_sessions_user_id      ON oral_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_oral_sessions_user_started ON oral_sessions (user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_oral_sessions_user_grade   ON oral_sessions (user_id, overall_grade);
CREATE INDEX IF NOT EXISTS idx_oral_sessions_started_at   ON oral_sessions (started_at);

-- school_members: joined on every school/admin query
CREATE INDEX IF NOT EXISTS idx_school_members_user_id     ON school_members (user_id);
CREATE INDEX IF NOT EXISTS idx_school_members_school_role ON school_members (school_id, role);

-- instructor_students: auth checks and dashboard student lists
CREATE INDEX IF NOT EXISTS idx_instructor_students_instructor ON instructor_students (instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_students_student    ON instructor_students (student_id);

-- user_skill: ordered/filtered by user_id and mastery on progress pages
CREATE INDEX IF NOT EXISTS idx_user_skill_user_id      ON user_skill (user_id);
CREATE INDEX IF NOT EXISTS idx_user_skill_user_mastery ON user_skill (user_id, mastery);

-- cfi_notes: filtered by student_id on student detail page
CREATE INDEX IF NOT EXISTS idx_cfi_notes_student_id ON cfi_notes (student_id);

-- session_questions: result filtered in score calculations across dashboards
CREATE INDEX IF NOT EXISTS idx_session_questions_result ON session_questions (result);
