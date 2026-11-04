# Authentication and session design

Implemented on `fix/auth-session-security`, 4 November 2026. Historical findings remain in [the audit](../mvp-audit/SECURITY_FINDINGS.md); this document describes the replacement behavior.

## Verification and account setup

Email addresses are normalized. OTPs use a cryptographic generator, bcrypt hashes, five-minute database-clock expiry, a one-minute send cooldown and ten failed attempts. Send authorization locks the user row to prevent parallel resend requests bypassing the cooldown. Redis holds short-lived attempt/rate counters; loss of Redis does not grant access.

Successful email verification consumes the OTP transactionally and returns a random 256-bit setup proof. MySQL stores its SHA-256 digest with ten-minute expiry and user identity. Password setup requires that proof and consumes it in the same transaction that activates the account, creates its profile and grants READER. A failed transaction leaves the proof available for retry. Reloading the setup page loses the in-memory proof; the user must verify again. Passwords require at least twelve characters and at most 72 UTF-8 bytes; bcrypt cost is twelve.

The registration marker distinguishes unfinished accounts from blocked established accounts, which cannot re-register or be removed by unfinished-registration cleanup.

## Tokens and durable sessions

JWT verification explicitly permits RS256, issuer `hibook`, audience `hibook-web`, the expected user and token purpose. Access tokens last fifteen minutes; refresh tokens last seven days. Both carry session ID and JTI. Authentication checks active account state and an unrevoked, unexpired MySQL session on every request; access-token JTI revocation additionally uses Redis. No refresh token is returned in JSON.

Refresh rotation locks the user and session, compares the stored refresh JTI, and replaces it atomically. Reusing an older JTI commits revocation of that session family before rejecting the request. In a malicious concurrent replay, one rotation may return tokens before the second request revokes the family; those returned tokens are then unusable. Other independent sessions remain active.

The frontend shares refresh requests within a tab. Web Locks serialize refresh-cookie rotation across tabs where supported. Browsers lacking Web Locks retain per-tab coordination; simultaneous cross-tab refresh can conservatively require login again. Strict replay detection takes precedence over accepting a reused token.

Logout revokes the family durably. `POST /v1/api/access/logout-all` revokes all user sessions. Password reset changes the password, consumes the reset OTP and revokes all sessions in one transaction. Issuance checks that the password hash verified at login still matches under the user lock, preventing a stale login racing a reset.

Legacy HMAC tokens are intentionally rejected. RSA keys are generated on the first new login and stored in the existing private-key table. Database permissions, encrypted storage/backups and key-management operations remain deployment responsibilities; this change does not introduce a KMS or claim encrypted application-level key storage.

## Browser and request boundaries

Access/setup tokens stay in memory. Refresh cookies are HttpOnly, SameSite=Lax, Secure in production, with a seven-day lifetime. A second HttpOnly access cookie lasts fifteen minutes. `POST /access/session` verifies that access token and its session/JTI, then returns the same access token without extending or rotating anything. This allows reloads and rapid full-page navigation without interrupting refresh rotation. Business routes continue to require Bearer authentication; they do not accept cookies as implicit authorization. When the access cookie expires, restoration performs real refresh rotation. An interrupted rotation at that expiry boundary can still conservatively require login again; no replay grace is granted.

The non-secret local user ID selects the verification key; it does not authorize a request. Session/refresh require that ID in a custom header. Auth endpoints reject an explicitly untrusted Origin and return `Cache-Control: no-store`; CORS allows only the configured frontend. Production must use HTTPS and the intended frontend origin. Production SMTP refuses disabled certificate verification.

Login is limited per IP and normalized account. Other auth endpoints have IP limits and OTP operations have per-user controls. Proxy trust is disabled by default: configure a reviewed proxy policy before relying on client IP limits behind a reverse proxy. No authentication secrets, OTPs or decoded claims are deliberately logged.

## Author approval

Approval locks the application and provisions its author profile, AUTHOR role and decision in a transaction. Repeated approval repairs an old missing profile without rewriting an existing decision. Rejection, withdrawal and review transitions lock the same application. Publishing and upload authorization require an approved author profile as well as existing role/ownership checks. The additive backfill repairs missing profiles only for approved applications already holding AUTHOR and preserves existing author approval flags.

## Migration and rollout

Apply `20261104_0002_auth_sessions.sql` and `20261104_0003_author_provisioning.sql` through the existing runner after a database backup and review. They have been applied only to the isolated QA schema. Keep the tables during application rollback; no legacy book, chapter or image content is converted. An old application rollback would reintroduce the audited auth defects and is not a security-safe fallback. Existing users must log in again after this rollout.

See [test evidence](../mvp/TEST_REPORT.md). SMTP outside the local sink, production HTTPS/CORS/proxy behavior and deployment against the normal database remain unverified.

## Client response ordering

Client session generations prevent a late profile or refresh response from restoring a logged-out session, and prevent an older request's 401 from clearing a newer login. Account and author guards subscribe to identity changes. Profile verification during restoration skips interceptor refresh; otherwise a 401 can recursively await the same pending restoration promise. Regression tests reproduce all three stale-response races and a headed forced-bootstrap-401 journey verifies termination. These guards manage client state; durable server session checks remain authoritative.

## Final client hydration review

The shared access hook scopes a permission response to its identity and retry attempt. Same-user hydration retains mounted draft state; logout or a different identity removes it before another outlet can use that permission. Parallel API calls now await restoration even after its token arrives, until profile verification finishes. If profile verification fails recoverably, the incomplete in-memory token is cleared while the non-secret saved user ID remains available for retry. Component regressions and the headed profile/session outage journeys passed after reproducing these cases.
