CREATE TABLE IF NOT EXISTS platform_moderation_policy (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  reports_enabled TINYINT(1) NOT NULL DEFAULT 1,
  reports_per_day INT UNSIGNED NOT NULL DEFAULT 5,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO platform_moderation_policy(id) VALUES(1);
-- Independent of author-controlled draft/publication state. Authors cannot remove these flags by publishing.
CREATE TABLE IF NOT EXISTS moderation_flags (
  kind ENUM('BOOK','CHAPTER','POST') NOT NULL,
  resource_id BIGINT UNSIGNED NOT NULL,
  hidden TINYINT(1) NOT NULL,
  reason VARCHAR(2000) NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(kind,resource_id),
  CONSTRAINT fk_flag_admin FOREIGN KEY(admin_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS content_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reporter_user_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('BOOK','CHAPTER','POST') NOT NULL,
  resource_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(2000) NOT NULL,
  status ENUM('OPEN','REVIEWING','RESOLVED','DISMISSED') NOT NULL DEFAULT 'OPEN',
  resolution VARCHAR(2000) NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  reviewed_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_report_queue(status,id),
  KEY idx_report_rate(reporter_user_id,created_at),
  CONSTRAINT fk_reporter FOREIGN KEY(reporter_user_id) REFERENCES users(id),
  CONSTRAINT fk_report_reviewer FOREIGN KEY(reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
