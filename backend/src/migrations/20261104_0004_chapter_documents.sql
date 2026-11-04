-- Add structured content beside legacy Markdown. No conversion or overwrite of existing text.
CREATE TABLE IF NOT EXISTS chapter_documents (
  chapter_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  schema_version SMALLINT UNSIGNED NOT NULL,
  document_json JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_document_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
