# MVP acceptance checklist

States: NOT STARTED, IN PROGRESS, BLOCKED, COMPLETED, VERIFIED, MERGED. A passing narrow capability does not complete its parent module.

| Category | Status | Implementation / evidence | Remaining work / commit |
|---|---|---|---|
| Audit preservation | MERGED | `docs/mvp-audit/`, `docs/publishing/` | `eed0a70` |
| Auth and sessions | MERGED | `session.service.ts`, `access.service.ts`, auth middleware, `auth.integration.test.ts`, `e2e/auth.spec.ts` | `bac8f04`, merge `4e602cd`; [passed checks](TEST_REPORT.md) |
| Author approval | MERGED | Transactional application decisions, author backfill, application/review pages | `bac8f04`, merge `4e602cd`; headed onboarding passed |
| Text-first block editor | MERGED | `features/studio/`, `domain/novelDocument.ts`, chapter document repository/migration | `d326c94`, merge `30fef17`; [passed checks](TEST_REPORT.md) |
| Book/chapter CRUD and draft/publish | MERGED | Existing publishing service and tests; publishing report | Rich text integration; original merge `82b4bf9` |
| Reader experience | MERGED | Structured and legacy rendering, typography, preferences, navigation/progress; desktop/mobile browser checks | `d326c94`, merge `30fef17`; discovery/library remain separate |
| Optional Cloudinary images | MERGED | Signed intent/confirmation flow and existing E2E | Preserve through rich text changes; original merge `82b4bf9` |
| Membership tiers and entitlements | VERIFIED | `membership.service.ts`, `entitlement.service.ts`, membership repository, policy/tier/post migration and UI | 63 backend / 12 frontend tests; seven headed journeys passed. Checkout/provider management and actual chat remain separate dependencies. Commit recorded in progress after merge. |
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
