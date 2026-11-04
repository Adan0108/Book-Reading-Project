# Security boundaries and deployment limits

See [session/setup design](AUTH_SESSIONS.md) for the repaired audit findings and regression evidence. The [original audit](../mvp-audit/SECURITY_FINDINGS.md) is historical, not a description of the current auth implementation.

- RS256 purpose-bound tokens are backed by durable MySQL sessions. Refresh rotation is atomic; replay revokes its family. Password reset and account suspension revoke sessions transactionally. Browser tokens remain in memory and HttpOnly cookies.
- Setup requires a caller-bound proof issued after OTP verification. Public profile changes cannot alter passwords, email or roles. Admin provisioning has no public endpoint or default password.
- Central entitlements check the author, book, chapter/post and current paid invoice window before protected bodies or image URLs are returned. Redis content caches sit behind fresh authorization. Socket fanout revalidates both participant sessions and current membership.
- Uploads use server destinations, signed parameters and provider lookup, not trusted browser URLs. Files stay local until save. No new editor uses buffered media or performs cloud deletion.
- Stripe accepts sandbox keys and verified raw signed events. Quote amounts/share and author identity are server controlled. Stable keys, unique provider IDs and append-only refund adjustments defend retries and late events. The test provider exists only in the QA harness.
- Auth/OTP/revocation Redis operations fail closed with 503 and bounded command waits. Descriptive caches fall back to SQL. View dedup failure does not claim an additional counted view. Redis uses noeviction in Compose so memory pressure cannot silently evict rate/revocation state.
- Proxy trust is explicit. The gateway replaces client-supplied forwarding headers. Direct deployments default to trusting no proxy. Review the exact trusted CIDRs for a real deployment.

## Remaining operational boundaries

Cloudinary artwork currently uses public delivery. Access checks prevent unauthorized API disclosure, but previously obtained image URLs can be fetched independently. Do not advertise expiring media protection or DRM. Existing cloud resources have not been converted or deleted.

Private JWT keys remain in the database's existing key table; encrypted storage/backups and least-privilege operations are operator responsibilities. This is not a KMS integration. Unsent files/composers are not durable offline storage. Chat supports one backend instance. Browser snapshots are not proof of physical touch-device or maximum-size chapter stress performance.

External Stripe sandbox, external SMTP delivery, production HTTPS/proxy behavior and rollout to the owner's normal database require separate verification. Local Mailpit is a development mailbox, and simulated checkout is not provider evidence. Production requires HTTPS, `NODE_ENV=production`, reviewed proxy settings and validated SMTP TLS. Self-signed SMTP bypass is refused in production.

Nodemailer was upgraded from 7 to 10.3.1 with bundled types, per its [migration requirements](https://nodemailer.com/). The observed backend audit then had nine moderate advisories and no high/critical advisories. Earlier frontend auditing reported twelve moderate tooling/transitive issues. Recheck current lockfiles at release; passing feature tests is not a complete dependency or penetration audit.
