-- Additive only. Existing Markdown and fan_arts remain intact.
CREATE TABLE IF NOT EXISTS publishing_assets (
  id CHAR(36) PRIMARY KEY,
  author_id BIGINT UNSIGNED NOT NULL,
  book_id BIGINT UNSIGNED NULL,
  purpose ENUM('cover','chapter') NOT NULL,
  public_id VARCHAR(255) NOT NULL UNIQUE,
  expected_bytes INT UNSIGNED NOT NULL,
  expected_format VARCHAR(10) NOT NULL,
  cloud_asset_id VARCHAR(255) NULL UNIQUE,
  image_url VARCHAR(1024) NULL,
  confirmed_at DATETIME NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_asset_quota (author_id, created_at),
  CONSTRAINT fk_asset_author FOREIGN KEY (author_id) REFERENCES authors(id),
  CONSTRAINT fk_asset_book FOREIGN KEY (book_id) REFERENCES books(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chapter_images (
  chapter_id BIGINT UNSIGNED NOT NULL,
  asset_id CHAR(36) NOT NULL UNIQUE,
  page_order INT UNSIGNED NOT NULL,
  PRIMARY KEY (chapter_id, page_order),
  CONSTRAINT fk_page_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id),
  CONSTRAINT fk_page_asset FOREIGN KEY (asset_id) REFERENCES publishing_assets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS book_covers (
  book_id BIGINT UNSIGNED PRIMARY KEY,
  asset_id CHAR(36) NOT NULL UNIQUE,
  CONSTRAINT fk_cover_book FOREIGN KEY (book_id) REFERENCES books(id),
  CONSTRAINT fk_cover_asset FOREIGN KEY (asset_id) REFERENCES publishing_assets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS publishing_requests (
  author_id BIGINT UNSIGNED NOT NULL,
  request_id CHAR(36) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  result_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (author_id, request_id),
  CONSTRAINT fk_publish_author FOREIGN KEY (author_id) REFERENCES authors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
