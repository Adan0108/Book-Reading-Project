CREATE TABLE IF NOT EXISTS platform_membership_policy (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  tier_one_name VARCHAR(80) NOT NULL DEFAULT 'Supporter',
  tier_two_name VARCHAR(80) NOT NULL DEFAULT 'Patron',
  tier_one_cents INT UNSIGNED NOT NULL DEFAULT 500,
  tier_two_cents INT UNSIGNED NOT NULL DEFAULT 1000,
  tier_two_enabled TINYINT(1) NOT NULL DEFAULT 1,
  revenue_share_bps INT UNSIGNED NOT NULL DEFAULT 1000,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO platform_membership_policy(id) VALUES (1);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(64) NOT NULL,
  target VARCHAR(191) NOT NULL,
  details_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_admin_audit_created(created_at,id),
  CONSTRAINT fk_audit_admin FOREIGN KEY(admin_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Legacy tiers remain intact. New managed tiers have an explicit author-specific level.
CREATE TABLE IF NOT EXISTS membership_tier_levels (
  tier_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  author_id BIGINT UNSIGNED NOT NULL,
  level TINYINT UNSIGNED NOT NULL,
  CONSTRAINT chk_managed_tier_level CHECK(level IN (1,2)),
  UNIQUE KEY uq_author_level(author_id,level),
  CONSTRAINT fk_level_tier FOREIGN KEY(tier_id,author_id) REFERENCES membership_tiers(id,author_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS author_posts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  author_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  body MEDIUMTEXT NOT NULL,
  visibility ENUM('PUBLIC','MEMBERS','TIERS') NOT NULL DEFAULT 'PUBLIC',
  minimum_tier_id BIGINT UNSIGNED NULL,
  is_draft TINYINT(1) NOT NULL DEFAULT 1,
  published_at DATETIME NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_post_feed(author_id,is_draft,published_at,id),
  CONSTRAINT fk_post_author FOREIGN KEY(author_id) REFERENCES authors(id) ON DELETE RESTRICT,
  CONSTRAINT fk_post_tier FOREIGN KEY(minimum_tier_id,author_id) REFERENCES membership_tiers(id,author_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
