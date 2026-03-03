ALTER TABLE session_questions
  ADD COLUMN IF NOT EXISTS question_id VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS is_probe TINYINT(1) NOT NULL DEFAULT 0;

CREATE INDEX idx_session_questions_session_question
  ON session_questions (session_id, question_id);

