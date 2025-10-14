-- connect to db using vsc extension (host: localhost, port: 3306, user/password from your .env)

-- Creates the `users` table
CREATE TABLE IF NOT EXISTS `users` (
  `id`            BIGINT AUTO_INCREMENT PRIMARY KEY,
  `email`         VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `state`         TINYINT NOT NULL DEFAULT 1 COMMENT '1=active, 0=blocked',
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- for OTP when register
ALTER TABLE `users`
CHANGE COLUMN `state` `status` ENUM('UNVERIFIED', 'ACTIVE', 'BLOCKED') NOT NULL DEFAULT 'UNVERIFIED';

-- Creates the `roles` table
CREATE TABLE IF NOT EXISTS `roles` (
  `id`         BIGINT AUTO_INCREMENT PRIMARY KEY,
  `code`       VARCHAR(32) NOT NULL UNIQUE COMMENT '''READER'',''AUTHOR'',''ADMIN''',
  `name`       VARCHAR(64) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Creates the `user_roles` mapping table
CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id`    BIGINT NOT NULL,
  `role_id`    BIGINT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `role_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stores public-facing user information
CREATE TABLE `user_profiles` (
  `user_id` bigint PRIMARY KEY NOT NULL,
  `username` varchar(50) NOT NULL UNIQUE,
  `nickname` varchar(100),
  `avatar_url` varchar(255),
  `bio_description` text,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

-- (Optional but Recommended) Seed the `roles` table
INSERT INTO `roles` (`code`, `name`) VALUES
  ('READER', 'Reader'),
  ('AUTHOR', 'Author'),
  ('ADMIN', 'Admin');

  SELECT id, email, status FROM users WHERE email = 'testuser1@example.com';