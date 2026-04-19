CREATE TABLE IF NOT EXISTS author_applications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,

  user_id BIGINT UNSIGNED NOT NULL,

  -- user submission fields
  pen_name VARCHAR(100) NULL,
  application_title VARCHAR(150) NOT NULL,
  sample_title VARCHAR(150) NOT NULL,
  sample_story MEDIUMTEXT NOT NULL,
  bio TEXT NULL,
  motivation TEXT NULL,
  genres_json JSON NULL,
  portfolio_links_json JSON NULL,
  extra_json JSON NULL,

  -- workflow
  status ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED','WITHDRAWN') NOT NULL DEFAULT 'PENDING',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- review
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  decision_reason TEXT NULL,
  internal_notes TEXT NULL,

  -- future AI scoring
  spam_score DECIMAL(5,2) NULL,
  quality_score DECIMAL(5,2) NULL,
  ai_flags_json JSON NULL,
  ai_last_scored_at DATETIME NULL,

  -- audit/anti-abuse
  submit_ip VARCHAR(45) NULL,
  submit_user_agent VARCHAR(255) NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_author_applications_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_author_applications_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_author_applications_user ON author_applications(user_id);
CREATE INDEX idx_author_applications_status ON author_applications(status, submitted_at);
CREATE INDEX idx_author_applications_reviewed ON author_applications(reviewed_by, reviewed_at);