CREATE TABLE IF NOT EXISTS author_profile_details (
  author_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  public_bio TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_author_details FOREIGN KEY(author_id) REFERENCES authors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS author_follows (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_author_follow(user_id,author_id),
  KEY idx_follow_list(user_id,id),
  KEY idx_follow_author(author_id),
  CONSTRAINT fk_follow_user FOREIGN KEY(user_id) REFERENCES users(id),
  CONSTRAINT fk_follow_author FOREIGN KEY(author_id) REFERENCES authors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS book_bookmarks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  book_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_bookmark(user_id,book_id),
  KEY idx_bookmark_list(user_id,id),
  CONSTRAINT fk_bookmark_user FOREIGN KEY(user_id) REFERENCES users(id),
  CONSTRAINT fk_bookmark_book FOREIGN KEY(book_id) REFERENCES books(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS reading_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  chapter_id BIGINT UNSIGNED NOT NULL,
  progress_pct TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_read_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_reading_chapter(user_id,chapter_id),
  KEY idx_history_user_time(user_id,last_read_at,id),
  CONSTRAINT chk_reading_progress CHECK(progress_pct<=100),
  CONSTRAINT fk_history_user FOREIGN KEY(user_id) REFERENCES users(id),
  CONSTRAINT fk_history_chapter FOREIGN KEY(chapter_id) REFERENCES chapters(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
