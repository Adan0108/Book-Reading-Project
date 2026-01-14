START TRANSACTION;

-- ============================================================
-- 0) PASSWORD HASHES (REPLACE THESE with your real bcrypt hashes)
-- ============================================================
SET @HASH_AUTHOR = '$2b$10$REPLACE_WITH_REAL_BCRYPT_HASH_FOR_AUTHOR';
SET @HASH_READER = '$2b$10$REPLACE_WITH_REAL_BCRYPT_HASH_FOR_READERS';

-- ============================================================
-- 1) ROLES
-- ============================================================

-- ============================================================
-- 2) USERS (1 author + 3 readers)
-- ============================================================
-- Author user
INSERT INTO users (email, password_hash, state)
VALUES ('author1@test.local', @HASH_AUTHOR, 1)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), password_hash = VALUES(password_hash);
SET @U_AUTHOR = LAST_INSERT_ID();

INSERT INTO user_profiles (user_id, username, nickname, is_private)
VALUES (@U_AUTHOR, 'author1', 'Author One', 0)
ON DUPLICATE KEY UPDATE username = VALUES(username), nickname = VALUES(nickname);

INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (@U_AUTHOR, @ROLE_AUTHOR);

-- Reader: no membership
INSERT INTO users (email, password_hash, state)
VALUES ('reader_free@test.local', @HASH_READER, 1)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), password_hash = VALUES(password_hash);
SET @U_READER_FREE = LAST_INSERT_ID();

INSERT INTO user_profiles (user_id, username, nickname, is_private)
VALUES (@U_READER_FREE, 'reader_free', 'Reader Free', 0)
ON DUPLICATE KEY UPDATE username = VALUES(username), nickname = VALUES(nickname);

INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (@U_READER_FREE, @ROLE_READER);

-- Reader: Bronze member
INSERT INTO users (email, password_hash, state)
VALUES ('reader_bronze@test.local', @HASH_READER, 1)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), password_hash = VALUES(password_hash);
SET @U_READER_BRONZE = LAST_INSERT_ID();

INSERT INTO user_profiles (user_id, username, nickname, is_private)
VALUES (@U_READER_BRONZE, 'reader_bronze', 'Reader Bronze', 0)
ON DUPLICATE KEY UPDATE username = VALUES(username), nickname = VALUES(nickname);

INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (@U_READER_BRONZE, @ROLE_READER);

-- Reader: Gold member
INSERT INTO users (email, password_hash, state)
VALUES ('reader_gold@test.local', @HASH_READER, 1)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), password_hash = VALUES(password_hash);
SET @U_READER_GOLD = LAST_INSERT_ID();

INSERT INTO user_profiles (user_id, username, nickname, is_private)
VALUES (@U_READER_GOLD, 'reader_gold', 'Reader Gold', 0)
ON DUPLICATE KEY UPDATE username = VALUES(username), nickname = VALUES(nickname);

INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (@U_READER_GOLD, @ROLE_READER);

-- ============================================================
-- 3) AUTHOR PROFILE (authors table)
-- ============================================================
INSERT INTO authors (user_id, pen_name, is_approved)
VALUES (@U_AUTHOR, 'Test Author', 1)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), pen_name = VALUES(pen_name), is_approved = VALUES(is_approved);
SET @AUTHOR_ID = LAST_INSERT_ID();

-- ============================================================
-- 4) MEMBERSHIP TIERS (Bronze, Gold) for this author
-- ============================================================
INSERT INTO membership_tiers (author_id, name, description, price, currency, interval_count, is_active)
VALUES
(@AUTHOR_ID, 'Bronze', 'Bronze tier access', 5.00, 'USD', 'MONTH', 1, 1)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), price = VALUES(price), is_active = VALUES(is_active);
SET @TIER_BRONZE = LAST_INSERT_ID();

INSERT INTO membership_tiers (author_id, name, description, price, currency, interval_count, is_active)
VALUES
(@AUTHOR_ID, 'Gold', 'Gold tier access', 10.00, 'USD', 'MONTH', 1, 1)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), price = VALUES(price), is_active = VALUES(is_active);
SET @TIER_GOLD = LAST_INSERT_ID();

-- ============================================================
-- 5) MEMBERSHIPS (reader_bronze has Bronze; reader_gold has Gold)
-- (avoid duplicates)
-- ============================================================
INSERT INTO memberships (
  user_id, author_id, tier_id, status, started_at, current_period_end, auto_renew, provider
)
SELECT @U_READER_BRONZE, @AUTHOR_ID, @TIER_BRONZE, 'ACTIVE', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 1, 'MANUAL'
WHERE NOT EXISTS (
  SELECT 1 FROM memberships
  WHERE user_id = @U_READER_BRONZE AND author_id = @AUTHOR_ID AND tier_id = @TIER_BRONZE AND status = 'ACTIVE'
);

INSERT INTO memberships (
  user_id, author_id, tier_id, status, started_at, current_period_end, auto_renew, provider
)
SELECT @U_READER_GOLD, @AUTHOR_ID, @TIER_GOLD, 'ACTIVE', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 1, 'MANUAL'
WHERE NOT EXISTS (
  SELECT 1 FROM memberships
  WHERE user_id = @U_READER_GOLD AND author_id = @AUTHOR_ID AND tier_id = @TIER_GOLD AND status = 'ACTIVE'
);

-- ============================================================
-- 6) TAGS + BOOK_TAGS
-- ============================================================
INSERT INTO tags (slug, name)
VALUES ('fantasy','Fantasy')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @TAG_FANTASY = LAST_INSERT_ID();

INSERT INTO tags (slug, name)
VALUES ('action','Action')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @TAG_ACTION = LAST_INSERT_ID();

INSERT INTO tags (slug, name)
VALUES ('romance','Romance')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @TAG_ROMANCE = LAST_INSERT_ID();

-- ============================================================
-- 7) BOOKS (PUBLIC / MEMBERS / TIERS)
-- ============================================================
-- PUBLIC book (discoverable)
INSERT INTO books (author_id, title, genre, slug, synopsis, cover_image_url, status, visibility)
VALUES (@AUTHOR_ID, 'Public Book', 'Fantasy', 'public-book', 'Everyone can see this book.', NULL, 'PUBLISHED', 'PUBLIC')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), status = VALUES(status), visibility = VALUES(visibility);
SET @BOOK_PUBLIC = LAST_INSERT_ID();

-- MEMBERS book (metadata public, chapters can be gated)
INSERT INTO books (author_id, title, genre, slug, synopsis, cover_image_url, status, visibility)
VALUES (@AUTHOR_ID, 'Members Book', 'Action', 'members-book', 'Readers can see description, but chapters may require membership.', NULL, 'PUBLISHED', 'MEMBERS')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), status = VALUES(status), visibility = VALUES(visibility);
SET @BOOK_MEMBERS = LAST_INSERT_ID();

-- TIERS book (metadata public, tier access controlled by access tables)
INSERT INTO books (author_id, title, genre, slug, synopsis, cover_image_url, status, visibility)
VALUES (@AUTHOR_ID, 'Tiers Book', 'Romance', 'tiers-book', 'Chapters can be unlocked by tier access.', NULL, 'PUBLISHED', 'TIERS')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), status = VALUES(status), visibility = VALUES(visibility);
SET @BOOK_TIERS = LAST_INSERT_ID();

-- Book tags
INSERT IGNORE INTO book_tags (book_id, tag_id) VALUES (@BOOK_PUBLIC, @TAG_FANTASY);
INSERT IGNORE INTO book_tags (book_id, tag_id) VALUES (@BOOK_PUBLIC, @TAG_ACTION);
INSERT IGNORE INTO book_tags (book_id, tag_id) VALUES (@BOOK_MEMBERS, @TAG_ACTION);
INSERT IGNORE INTO book_tags (book_id, tag_id) VALUES (@BOOK_TIERS, @TAG_ROMANCE);

-- ============================================================
-- 8) CHAPTERS
-- visibility enum in your DB: PUBLIC | MEMBERS | TIERS
-- ============================================================
-- PUBLIC book chapters
INSERT INTO chapters (book_id, author_id, title, slug, chapter_no, content_md, word_count, visibility, is_draft, published_at)
VALUES
(@BOOK_PUBLIC, @AUTHOR_ID, 'Public Ch 1', 'public-ch-1', 1, '# Public 1\nHello world', 3, 'PUBLIC', 0, NOW())
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), visibility = VALUES(visibility), is_draft = VALUES(is_draft);
SET @CH_PUBLIC_1 = LAST_INSERT_ID();

INSERT INTO chapters (book_id, author_id, title, slug, chapter_no, content_md, word_count, visibility, is_draft, published_at)
VALUES
(@BOOK_PUBLIC, @AUTHOR_ID, 'Public Ch 2', 'public-ch-2', 2, '# Public 2\nMore text', 3, 'PUBLIC', 0, NOW())
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), visibility = VALUES(visibility), is_draft = VALUES(is_draft);
SET @CH_PUBLIC_2 = LAST_INSERT_ID();

-- MEMBERS book chapters: one public teaser + one members-only
INSERT INTO chapters (book_id, author_id, title, slug, chapter_no, content_md, word_count, visibility, is_draft, published_at)
VALUES
(@BOOK_MEMBERS, @AUTHOR_ID, 'Members Teaser', 'members-ch-1', 1, '# Teaser\nFree chapter', 3, 'PUBLIC', 0, NOW())
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), visibility = VALUES(visibility), is_draft = VALUES(is_draft);
SET @CH_MEMBERS_1 = LAST_INSERT_ID();

INSERT INTO chapters (book_id, author_id, title, slug, chapter_no, content_md, word_count, visibility, is_draft, published_at)
VALUES
(@BOOK_MEMBERS, @AUTHOR_ID, 'Members Only', 'members-ch-2', 2, '# Locked\nRequires membership', 3, 'MEMBERS', 0, NOW())
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), visibility = VALUES(visibility), is_draft = VALUES(is_draft);
SET @CH_MEMBERS_2 = LAST_INSERT_ID();

-- TIERS book chapters: one public + one bronze + one gold
INSERT INTO chapters (book_id, author_id, title, slug, chapter_no, content_md, word_count, visibility, is_draft, published_at)
VALUES
(@BOOK_TIERS, @AUTHOR_ID, 'Tiers Teaser', 'tiers-ch-1', 1, '# Teaser\nFree chapter', 3, 'PUBLIC', 0, NOW())
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), visibility = VALUES(visibility), is_draft = VALUES(is_draft);
SET @CH_TIERS_1 = LAST_INSERT_ID();

INSERT INTO chapters (book_id, author_id, title, slug, chapter_no, content_md, word_count, visibility, is_draft, published_at)
VALUES
(@BOOK_TIERS, @AUTHOR_ID, 'Bronze Locked', 'tiers-ch-2', 2, '# Bronze\nBronze or higher', 3, 'TIERS', 0, NOW())
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), visibility = VALUES(visibility), is_draft = VALUES(is_draft);
SET @CH_TIERS_2 = LAST_INSERT_ID();

INSERT INTO chapters (book_id, author_id, title, slug, chapter_no, content_md, word_count, visibility, is_draft, published_at)
VALUES
(@BOOK_TIERS, @AUTHOR_ID, 'Gold Locked', 'tiers-ch-3', 3, '# Gold\nGold only', 3, 'TIERS', 0, NOW())
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), visibility = VALUES(visibility), is_draft = VALUES(is_draft);
SET @CH_TIERS_3 = LAST_INSERT_ID();

-- ============================================================
-- 9) TIER ACCESS TABLES
-- book_tier_access / chapter_tier_access
--
-- If your app logic checks TIERS visibility by:
--   - membership exists with tier_id
--   - AND access row exists (content_id + tier_id + author_id)
-- then these are required.
-- ============================================================

-- Allow TIERS book for Bronze and Gold
INSERT IGNORE INTO book_tier_access (book_id, author_id, tier_id)
VALUES
(@BOOK_TIERS, @AUTHOR_ID, @TIER_BRONZE),
(@BOOK_TIERS, @AUTHOR_ID, @TIER_GOLD);

-- Chapter 2 (bronze+) accessible by Bronze + Gold
INSERT IGNORE INTO chapter_tier_access (chapter_id, author_id, tier_id)
VALUES
(@CH_TIERS_2, @AUTHOR_ID, @TIER_BRONZE),
(@CH_TIERS_2, @AUTHOR_ID, @TIER_GOLD);

-- Chapter 3 (gold only)
INSERT IGNORE INTO chapter_tier_access (chapter_id, author_id, tier_id)
VALUES
(@CH_TIERS_3, @AUTHOR_ID, @TIER_GOLD);

COMMIT;
