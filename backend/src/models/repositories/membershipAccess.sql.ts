/** Shared SQL predicate for the fixed internal membership alias `m`. Never interpolate client identifiers. */
export const activeMembershipSql = `m.status='ACTIVE' AND m.started_at<=NOW() AND m.current_period_end>NOW()
  AND (NOT EXISTS(SELECT 1 FROM billing_subscriptions bs WHERE bs.membership_id=m.id)
    OR EXISTS(SELECT 1 FROM billing_subscriptions bs JOIN billing_payments bp ON bp.intent_id=bs.intent_id
      WHERE bs.membership_id=m.id AND bp.refunded_cents<bp.gross_cents AND bp.period_start<=NOW() AND bp.period_end>NOW()))`;
