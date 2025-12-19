-- BOOKS MODULE -------------------------------------------------------
-- Requires existing: users, authors, roles, user_roles

SET FOREIGN_KEY_CHECKS = 0;

-- BOOKS --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS books (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  author_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  genre VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  synopsis TEXT,
  cover_image_url VARCHAR(255),
  status ENUM('DRAFT','PUBLISHED','HIDDEN') NOT NULL DEFAULT 'DRAFT',
  visibility ENUM('PUBLIC','MEMBERS','TIERS') NOT NULL DEFAULT 'PUBLIC',
  likes_count INT NOT NULL DEFAULT 0,
  views_count INT NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_books_slug (slug),
  KEY idx_books_author (author_id),
  KEY idx_books_author_status (author_id, status),
  KEY idx_books_feed (status, visibility, created_at),
  KEY idx_books_created (created_at),
  UNIQUE KEY uq_book_id_author (id, author_id),
  CONSTRAINT fk_books_author FOREIGN KEY (author_id) REFERENCES authors(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CHAPTERS ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chapters (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  book_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  chapter_no INT NOT NULL,
  content_md LONGTEXT,
  word_count INT,
  visibility ENUM('PUBLIC','MEMBERS','TIERS') NOT NULL DEFAULT 'PUBLIC',
  is_draft TINYINT(1) NOT NULL DEFAULT 0,
  scheduled_at DATETIME NULL,
  published_at DATETIME NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ch_book_no (book_id, chapter_no),
  UNIQUE KEY uq_ch_book_slug (book_id, slug),
  KEY idx_ch_visibility (visibility),
  KEY idx_ch_toc (book_id, is_draft, published_at),
  KEY idx_ch_published (published_at),
  UNIQUE KEY uq_chapter_id_author (id, author_id),
  KEY idx_ch_book_author (book_id, author_id),
  CONSTRAINT fk_chapters_book FOREIGN KEY (book_id) REFERENCES books(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_chapters_author FOREIGN KEY (author_id) REFERENCES authors(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  -- Enforce: chapter.author_id must match book.author_id (via composite reference)
  CONSTRAINT fk_chapters_book_author FOREIGN KEY (book_id, author_id) REFERENCES books(id, author_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- TAGS ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tags_slug (slug),
  KEY idx_tags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- BOOK_TAGS -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS book_tags (
  book_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (book_id, tag_id),
  KEY idx_bt_tag (tag_id),
  CONSTRAINT fk_book_tags_book FOREIGN KEY (book_id) REFERENCES books(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_book_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- MEMBERSHIP TIERS ----------------------------------------------------
CREATE TABLE IF NOT EXISTS membership_tiers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  author_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  interval_unit ENUM('MONTH') NOT NULL DEFAULT 'MONTH',
  interval_count INT NOT NULL DEFAULT 1,
  benefits_json JSON,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tiers_author_active (author_id, is_active),
  UNIQUE KEY uq_tier_name_per_author (author_id, name),
  UNIQUE KEY uq_tier_id_author (id, author_id),
  CONSTRAINT fk_tiers_author FOREIGN KEY (author_id) REFERENCES authors(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- MEMBERSHIPS ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS memberships (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  tier_id BIGINT UNSIGNED NOT NULL,
  status ENUM('ACTIVE','CANCELED','EXPIRED','PAST_DUE') NOT NULL DEFAULT 'ACTIVE',
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  current_period_end DATETIME NOT NULL,
  auto_renew TINYINT(1) NOT NULL DEFAULT 1,
  provider ENUM('STRIPE','PAYPAL','MANUAL') NOT NULL DEFAULT 'STRIPE',
  provider_sub_id VARCHAR(191),
  last_payment_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_member_access (user_id, author_id, status, current_period_end),
  KEY idx_member_author_status (author_id, status),
  CONSTRAINT fk_memberships_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_memberships_author FOREIGN KEY (author_id) REFERENCES authors(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_memberships_tier_author FOREIGN KEY (tier_id, author_id) REFERENCES membership_tiers(id, author_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- TIERS ACCESS --------------------------------------------------------
CREATE TABLE IF NOT EXISTS book_tier_access (
  book_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  tier_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (book_id, author_id, tier_id),
  KEY idx_bta_tier_author (tier_id, author_id),
  CONSTRAINT fk_bta_book_author FOREIGN KEY (book_id, author_id) REFERENCES books(id, author_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_bta_tier_author FOREIGN KEY (tier_id, author_id) REFERENCES membership_tiers(id, author_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chapter_tier_access (
  chapter_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  tier_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (chapter_id, author_id, tier_id),
  KEY idx_cta_tier_author (tier_id, author_id),
  CONSTRAINT fk_cta_chapter_author FOREIGN KEY (chapter_id, author_id) REFERENCES chapters(id, author_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cta_tier_author FOREIGN KEY (tier_id, author_id) REFERENCES membership_tiers(id, author_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
