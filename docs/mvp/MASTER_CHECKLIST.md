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
| Membership tiers and entitlements | MERGED | `membership.service.ts`, `entitlement.service.ts`, membership repository, policy/tier/post migration and UI | `17a6350`, merge `d55593e`; 63 backend / 12 frontend tests and seven headed journeys at merge. Actual chat remains a separate dependency. |
| Payment adapter and sandbox evidence | MERGED | `payments/`, billing migrations/routes, plans, checkout/status/history UI; signed SDK fixtures and real MySQL | `8921b5a`, merge `1359447`; 78 backend / 12 frontend tests and eight headed journeys at merge. Live Stripe sandbox UNVERIFIED without credentials. |
| Donations | MERGED | Server-validated USD checkout, ledger/splits/refunds, reader and author history UI | `8921b5a`, merge `1359447`; fixture end-to-end passed; no real financial transactions |
| Member chat | MERGED | `chat/`, conversation repository, routes/migration, `features/chat/`, ChatPage | `a36e970`, merge `2e64620`; 87 backend / 12 frontend tests and nine headed journeys at merge |
| Admin moderation | VERIFIED | `moderation.service.ts`, target/public-visibility repositories, migration/routes, shared admin UI, reports and author notices | 97 backend / 12 frontend tests and all ten headed journeys passed; delayed-preview regression passed |
| Search/discovery | IN PROGRESS | Search API exists | Real home catalog, stable validation/pagination and journeys |
| Profiles and library | IN PROGRESS | Existing partial profile/detail pages | Author data, follows/bookmarks/history/posts |
| Redis | IN PROGRESS | Cache, OTP, JTI and auth rates | Failure handling, cache availability checks and operational review |
| OpenAPI | IN PROGRESS | Existing incomplete Swagger | Update implemented contracts; later modules as delivered |
| Docker deployment | NOT STARTED | Existing infrastructure-only compose | App images, readiness and isolated startup verification |
| UI/accessibility/responsive | IN PROGRESS | Application forms/guards and publishing alternatives | Cross-screen system, viewport and keyboard evidence |
| Regression/release | IN PROGRESS | [Executed tests](TEST_REPORT.md) | Full cross-module suite and final release assessment |

Known business gaps and non-auth audit risks remain open. No percentage or production-ready claim is assigned.
