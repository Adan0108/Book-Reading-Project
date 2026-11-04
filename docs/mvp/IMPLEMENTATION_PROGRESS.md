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
| Member chat | MERGED | `feat/member-chat`: `a36e970`; merge `2e64620`; both remotes verified. 87 backend / 12 frontend tests and nine headed journeys at merge. Single-backend-instance delivery; no offline durable composer. |
| Admin moderation | MERGED | `feat/admin-moderation`: independent visibility flags, reports, account suspension/session revocation, versioned settings/reviews, audit, actual statistics and admin UI. 97 backend / 12 frontend tests and all ten headed journeys passed; delayed-preview focused regression also passed. Types/lint/builds pass. |
| Reader discovery and library | MERGED | Real catalog, profiles, follows/bookmarks and synchronized reading history; 109 backend / 15 frontend tests and twelve headed journeys pass. Core `bef86b4`, merge `4d9472c`, both remotes verified. Post spoilers/artwork remain a separate milestone. |
| Operations and API documentation | MERGED | `3b8fe99`, merge `74ba157`, both remotes verified. Awaited startup, migration locks/checksums, Redis failure boundaries, OpenAPI, non-root application images and fresh Compose verification; 125 backend tests, thirteen headed journeys plus one built-stack journey pass. |
| UI and release verification | VERIFIED | 127 backend / 18 frontend tests, fourteen headed journeys, 33 accessibility states and one final built Compose journey pass; final root README and engineering guides complete. Merged-main verification follows integration. |

## Safety and environment

Use only the isolated `publishing_qa` MySQL fixture on localhost:3307 or the separate `hibook-mvp-verification-20261105` Compose project for verification writes. Do not migrate the normal configured database, flush shared Redis, send real email, create real financial transactions, or delete Cloudinary assets. Existing publishing cloud E2E tests create retained cloud assets and must be run intentionally. Never commit local `.env`, credentials, generated browser artifacts or database files.

## Current architectural changes

- Authentication is moving to purpose-bound RS256 tokens and durable MySQL session families. Rotation locks a session and compares its current refresh JTI; replay revokes that family. Password reset revokes all sessions in the password transaction. A legacy HMAC session requires login again.
- Setup requires a short-lived random proof returned only after successful OTP verification. Only its SHA-256 digest is stored. Proof consumption and account activation share a transaction.
- Author approval provisions both the author profile and role transactionally. Existing publishing ownership checks remain authoritative.
- Browser access tokens remain in memory; the HttpOnly refresh cookie restores a session. The stored user ID is an identifier, not an authentication credential.

Detailed validation and phase completion records will be added as they are executed. External integration configuration and verification must be reported separately from deterministic tests.

## Author post completion

`feat/author-posts-media` is MERGED (`cbca166`, merge `9755dcd`, both remotes verified): optional ordered artwork and spoiler controls reuse signed uploads and centralized entitlements; post save keys resolve ambiguous responses without duplicate posts. Backend 116 tests, frontend 15 tests, types/lint/builds and all thirteen headed journeys passed. This completes the remaining phase-seven product capabilities; operations and final UI/release verification are still outstanding.
