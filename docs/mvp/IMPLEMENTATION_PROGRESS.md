# HiBook implementation progress

Updated 4 November 2026 (Australia/Sydney). Baseline audit: [readiness audit](../mvp-audit/README.md).

The platform is **not release ready**. This is a living implementation record, separate from the historical audit. A checked item requires implementation and recorded validation; passing the publishing suite alone does not establish MVP readiness.

| Phase | Status | Remaining acceptance work |
|---|---|---|
| Audit documentation preservation | MERGED | Commit `eed0a70`, pushed to main |
| Authentication and author provisioning | MERGED | `fix/auth-session-security`: `bac8f04`; merge `4e602cd`; both remotes verified. 38 backend / 11 frontend tests and three headed E2E passed at merge. |
| Text-first block studio and reader | VERIFIED | `feat/light-novel-editor`: BlockNote, versioned documents, transactional asset order, autosave, legacy compatibility and reader preferences. Final 47 backend / 12 frontend tests and six headed browser tests passed; types/lint/builds pass. Pending Git integration. |
| Author memberships and entitlement policy | Pending | Tier management, pricing policy, centralized chapter/post/chat access |
| Payments and donations | Pending | Stripe adapter, sandbox checkout, verified/idempotent webhooks, ledger and reconciliation |
| Member chat | Pending | Authenticated sockets, persisted history/read state, entitlement expiry |
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
