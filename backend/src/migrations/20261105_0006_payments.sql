-- New financial records only. Existing manual memberships are retained unchanged.
CREATE TABLE IF NOT EXISTS billing_intents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  tier_id BIGINT UNSIGNED NULL,
  request_id CHAR(36) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  kind ENUM('MEMBERSHIP','DONATION') NOT NULL,
  cents INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL,
  policy_version INT UNSIGNED NOT NULL,
  share_bps INT UNSIGNED NOT NULL,
  label VARCHAR(200) NOT NULL,
  checkout_id VARCHAR(191) NULL,
  checkout_url TEXT NULL,
  expires_at DATETIME NOT NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_billing_request(user_id,request_id),
  UNIQUE KEY uq_checkout_id(checkout_id),
  KEY idx_intent_author(author_id,created_at),
  CONSTRAINT fk_intent_user FOREIGN KEY(user_id) REFERENCES users(id),
  CONSTRAINT fk_intent_author FOREIGN KEY(author_id) REFERENCES authors(id),
  CONSTRAINT fk_intent_tier FOREIGN KEY(tier_id,author_id) REFERENCES membership_tiers(id,author_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  provider_sub_id VARCHAR(191) NOT NULL PRIMARY KEY,
  intent_id CHAR(36) NOT NULL,
  membership_id BIGINT UNSIGNED NULL,
  provider_status VARCHAR(40) NOT NULL,
  auto_renew TINYINT(1) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subscription_intent(intent_id),
  UNIQUE KEY uq_billing_membership(membership_id),
  CONSTRAINT fk_billing_intent FOREIGN KEY(intent_id) REFERENCES billing_intents(id),
  CONSTRAINT fk_billing_membership FOREIGN KEY(membership_id) REFERENCES memberships(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS billing_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  intent_id CHAR(36) NOT NULL,
  provider_payment_id VARCHAR(191) NOT NULL,
  payment_intent_id VARCHAR(191) NOT NULL,
  gross_cents INT UNSIGNED NOT NULL,
  refunded_cents INT UNSIGNED NOT NULL DEFAULT 0,
  platform_cents INT UNSIGNED NOT NULL,
  author_cents INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL,
  period_start DATETIME NULL,
  period_end DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_billing_payment(provider_payment_id),
  UNIQUE KEY uq_payment_intent(payment_intent_id),
  KEY idx_payment_intent(intent_id,period_end),
  CONSTRAINT fk_payment_intent FOREIGN KEY(intent_id) REFERENCES billing_intents(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS billing_events (
  event_id VARCHAR(191) NOT NULL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  intent_id CHAR(36) NULL,
  result VARCHAR(40) NOT NULL,
  processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_event_intent FOREIGN KEY(intent_id) REFERENCES billing_intents(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
