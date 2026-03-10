ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS overall_grade ENUM('PASS','PROBE','REMEDIATE','FAIL') NULL,
  ADD COLUMN IF NOT EXISTS overall_summary TEXT NULL;

CREATE TABLE IF NOT EXISTS session_questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id VARCHAR(36) NOT NULL,
  question_id VARCHAR(64) NULL,
  acs_task VARCHAR(64) NULL,
  question_text TEXT NOT NULL,
  user_answer TEXT NULL,
  ai_feedback TEXT NULL,
  result ENUM('PASS','PROBE','REMEDIATE','FAIL') NULL,
  is_probe TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_session_questions_session_id (session_id),
  KEY idx_session_questions_session_question (session_id, question_id),
  KEY idx_session_questions_session_created (session_id, created_at),
  CONSTRAINT fk_session_questions_session
    FOREIGN KEY (session_id) REFERENCES sessions(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);
