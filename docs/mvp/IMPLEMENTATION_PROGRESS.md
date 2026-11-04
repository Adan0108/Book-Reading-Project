# HiBook implementation progress

Updated 5 November 2026 (Australia/Sydney). Baseline audit: [readiness audit](../mvp-audit/README.md).

The platform is **not release ready**. This is a living implementation record, separate from the historical audit. A checked item requires implementation and recorded validation; passing the publishing suite alone does not establish MVP readiness.

| Phase | Status | Remaining acceptance work |
|---|---|---|
| Audit documentation preservation | MERGED | Commit `eed0a70`, pushed to main |
| Authentication and author provisioning | MERGED | `fix/auth-session-security`: `bac8f04`; merge `4e602cd`; both remotes verified. 38 backend / 11 frontend tests and three headed E2E passed at merge. |
| Text-first block studio and reader | MERGED | `feat/light-novel-editor`: `d326c94`; merge `30fef17`; both remotes verified. 47 backend / 12 frontend tests and six headed browser tests passed; types/lint/builds pass. |
| Author memberships and entitlement policy | MERGED | `feat/author-memberships`: `17a6350`; merge `d55593e`; both remotes verified. 63 backend / 12 frontend tests and seven headed journeys passed, including optional-auth restoration and outage recovery. Actual conversations are a later dependency. |
| Payments and donations | MERGED | `feat/payment-donations`: `8921b5a`; merge `1359447`; both remotes verified. 78 backend / 12 frontend tests and eight headed journeys passed at merge. Live Stripe sandbox UNVERIFIED: missing credentials. |
| Member chat | VERIFIED | `feat/member-chat`: authenticated Socket.IO delivery, persisted/idempotent messages, pagination, read/unread state, author/member UI and expiry enforcement. 87 backend / 12 frontend tests and all nine headed journeys passed; types/lint/builds pass. Single-backend-instance delivery; no offline durable composer. |
| Admin moderation | Pending | Content/user actions, platform settings, audit log, operational dashboard |
| Reader discovery and library | Pending | Real catalog, profiles/posts, follow/bookmark/history flows |
| Operations and API documentation | Pending | Readiness, Redis failure handling, OpenAPI, reproducible application containers |
| UI and release verification | Pending | Integrated journeys, accessibility, responsive browser evidence and final root README |

## Safety and environment

Use only the isolated `publishing_qa` MySQL fixture on localhost:3307 for integration writes. Do not migrate the normal configured database, flush shared Redis, send real email, create real financial transactions, or delete Cloudinary assets. Existing publishing cloud E2E tests create retained cloud assets and must be run intentionally. Never commit local `.env`, credentials, generated browser artifacts or database files.

## Current architectural changes

- Authentication is moving to purpose-bound RS256 tokens and durable MySQL session families. Rotation locks a session and compares its current refresh JTI; replay revokes that family. Password reset revokes all sessions in the password transaction. A legacy HMAC session requires login again.
- Setup requires a short-lived random proof returned only after successful OTP verification. Only its SHA-256 digest is stored. Proof consumption and account activation share a transaction.
- Author approval provisions both the author profile and role transactionally. Existing publishing ownership checks remain authoritative.
- Browser access tokens remain in memory; the HttpOnly refresh cookie restores a session. The stored user ID is an identifier, not an authentication credential.

Detailed validation and phase completion records will be added as they are executed. External integration configuration and verification must be reported separately from deterministic tests.
