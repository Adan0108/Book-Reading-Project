CREATE TABLE IF NOT EXISTS fan_arts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    chapter_id BIGINT UNSIGNED NOT NULL,
    url TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_chapter_id (chapter_id),

    CONSTRAINT fk_fan_arts_chapter_id 
        FOREIGN KEY (chapter_id) 
        REFERENCES chapters (id) 
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;