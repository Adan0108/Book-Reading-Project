# MVP acceptance checklist

States: NOT STARTED, IN PROGRESS, BLOCKED, COMPLETED, VERIFIED, MERGED. A passing narrow capability does not complete its parent module.

| Category | Status | Implementation / evidence | Remaining work / commit |
|---|---|---|---|
| Audit preservation | MERGED | `docs/mvp-audit/`, `docs/publishing/` | `eed0a70` |
| Auth and sessions | VERIFIED | `session.service.ts`, `access.service.ts`, auth middleware, `auth.integration.test.ts`, `e2e/auth.spec.ts` | [Passed checks](TEST_REPORT.md); pending merge |
| Author approval | VERIFIED | Transactional application decisions, author backfill, application/review pages | Headed onboarding passed; pending merge |
| Text-first block editor | NOT STARTED | Baseline plain Markdown editor | Versioned blocks, autosave, inline media, long-form validation |
| Book/chapter CRUD and draft/publish | MERGED | Existing publishing service and tests; publishing report | Rich text integration; original merge `82b4bf9` |
| Reader experience | IN PROGRESS | Safe legacy Markdown and ordered illustrations | Typography, preferences, navigation/progress and structured rendering |
| Optional Cloudinary images | MERGED | Signed intent/confirmation flow and existing E2E | Preserve through rich text changes; original merge `82b4bf9` |
| Membership tiers and entitlements | NOT STARTED | Existing tables and narrow chapter checks only | Management UI/API, shared policy and business rules |
| Payment adapter and sandbox evidence | NOT STARTED | None | Checkout, verified webhooks, ledger, fixtures; live credentials separately |
| Donations | NOT STARTED | None | Verified payment/history/author totals |
| Member chat | NOT STARTED | None | Socket auth, persistence, expiry and reconnect journeys |
| Admin moderation | NOT STARTED | Application review alone is not moderation | Content/account controls, pricing/settings, audit log/dashboard |
| Search/discovery | IN PROGRESS | Search API exists | Real home catalog, stable validation/pagination and journeys |
| Profiles and library | IN PROGRESS | Existing partial profile/detail pages | Author data, follows/bookmarks/history/posts |
| Redis | IN PROGRESS | Cache, OTP, JTI and auth rates | Failure handling, cache availability checks and operational review |
| OpenAPI | IN PROGRESS | Existing incomplete Swagger | Update implemented contracts; later modules as delivered |
| Docker deployment | NOT STARTED | Existing infrastructure-only compose | App images, readiness and isolated startup verification |
| UI/accessibility/responsive | IN PROGRESS | Application forms/guards and publishing alternatives | Cross-screen system, viewport and keyboard evidence |
| Regression/release | IN PROGRESS | [Executed tests](TEST_REPORT.md) | Full cross-module suite and final release assessment |

Known business gaps and non-auth audit risks remain open. No percentage or production-ready claim is assigned.
