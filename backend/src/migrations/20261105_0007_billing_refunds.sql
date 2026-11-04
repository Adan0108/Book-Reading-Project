-- Append-only refund adjustments preserve the financial audit trail as totals change.
CREATE TABLE IF NOT EXISTS billing_refund_adjustments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payment_id BIGINT UNSIGNED NOT NULL,
  provider_event_id VARCHAR(191) NOT NULL,
  delta_cents INT UNSIGNED NOT NULL,
  cumulative_cents INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_refund_adjustment_event(provider_event_id),
  CONSTRAINT fk_refund_payment FOREIGN KEY(payment_id) REFERENCES billing_payments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
