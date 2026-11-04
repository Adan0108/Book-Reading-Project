CREATE TABLE IF NOT EXISTS member_conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  author_id BIGINT UNSIGNED NOT NULL,
  member_user_id BIGINT UNSIGNED NOT NULL,
  author_read_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  member_read_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_author_member_conversation(author_id,member_user_id),
  KEY idx_member_conversations(member_user_id,id),
  CONSTRAINT fk_conversation_author FOREIGN KEY(author_id) REFERENCES authors(id),
  CONSTRAINT fk_conversation_member FOREIGN KEY(member_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS member_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_user_id BIGINT UNSIGNED NOT NULL,
  client_id CHAR(36) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sender_message_request(sender_user_id,client_id),
  KEY idx_conversation_messages(conversation_id,id),
  KEY idx_sender_rate(sender_user_id,created_at),
  CONSTRAINT fk_message_conversation FOREIGN KEY(conversation_id) REFERENCES member_conversations(id),
  CONSTRAINT fk_message_sender FOREIGN KEY(sender_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
