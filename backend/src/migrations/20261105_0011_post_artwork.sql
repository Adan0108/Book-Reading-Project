ALTER TABLE publishing_assets MODIFY purpose ENUM('cover','chapter','post') NOT NULL;
CREATE TABLE IF NOT EXISTS post_details (
  post_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  is_spoiler TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_post_details FOREIGN KEY(post_id) REFERENCES author_posts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS post_images (
  post_id BIGINT UNSIGNED NOT NULL,
  asset_id CHAR(36) NOT NULL,
  image_order INT UNSIGNED NOT NULL,
  PRIMARY KEY(post_id,image_order),
  UNIQUE KEY uq_post_image_asset(asset_id),
  CONSTRAINT fk_post_image_post FOREIGN KEY(post_id) REFERENCES author_posts(id),
  CONSTRAINT fk_post_image_asset FOREIGN KEY(asset_id) REFERENCES publishing_assets(id),
  CONSTRAINT chk_post_image_order CHECK(image_order>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
