# Current implementation verification

Updated 5 November 2026 (Australia/Sydney). Run commands from the named package directory using `npm.cmd` on this Windows host. Earlier audit evidence remains historical.

## Authentication milestone (`bac8f04`, merge `4e602cd`)

| Directory / command | Observed result |
|---|---|
| `backend`: `$env:PUBLISHING_TEST_DATABASE='publishing_qa'; npm.cmd test` | 38 passed in four files, including real MySQL auth/approval and publishing integration; final run 22:41 Sydney |
| `backend`: `npm.cmd run typecheck` | Passed |
| `backend`: `npm.cmd run build` | Passed; runtime assets copied |
| `frontend`: `npm.cmd run typecheck` | Passed |
| `frontend`: `npm.cmd run lint` | Passed |
| `frontend`: `npm.cmd test` | 11 passed in three files |
| `frontend`: `npm.cmd run build` | Passed; existing bundle-size, DaisyUI and Node warnings remain |
| `frontend`: `npm.cmd run test:e2e -- auth.spec.ts` | One headed Chromium journey passed: registration, local SMTP OTP, secure setup, role rejection, application, admin approval, draft creation, reload, password reset, old-token rejection and new login. Zero Cloudinary uploads. |
| `frontend`: `npm.cmd run test:e2e` | All three passed in headed Chromium (31.3 s). Includes cross-tab restoration and rapid full navigation, actual signed Cloudinary upload/confirmation, sorting/reopening/publishing/reader order, legacy Markdown and unauthenticated rejection. Four test uploads were retained; no deletion. |
| Root: `git diff --check` | Passed before final documentation additions; rerun before staging |

Auth integration covers invalid/expired/reused OTP, exhausted attempts, missing/forged/expired/consumed setup proof, explicit RS256/purpose/caller checks, JTI revocation, atomic concurrent rotation and replay family revocation, password reset invalidation, logout/all, blocked accounts, expired sessions, stale-password issuance, approved/unapproved author boundaries, IP-independent account throttling and safe abandoned-registration cleanup. Existing publishing tests cover ownership, ordering, rollback and migration reruns.

Only the named `publishing_qa` schema on localhost:3307 is used. New migrations ran twice through the runner to verify tracked re-entry. The local QA SMTP sink binds loopback ports 2526/2527 and retains at most 100 test messages in memory; no real recipients receive mail. It is outside application source/production build. Redis is not flushed. Dependency installation added only a development SMTP sink; the existing backend audit still reports 9 moderate and 1 high advisory and needs a separate dependency review.

The first browser run failed on a test locator (`Email` versus the actual `Email Address` label); the corrected journey passed. An initial integration fixture reused the globally unique username `Reader`; it now generates a unique fixture username. The full suite then exposed refresh interruption during rapid navigation. The HttpOnly access-cookie restoration endpoint fixed that reproducible regression; the unchanged navigation sequence passed afterwards. No failed run is represented as a passing result.

Normal-database migration, real SMTP delivery, production HTTPS/proxy/cookie behavior and later MVP modules remain unverified. No deployment has occurred.

## Writing studio milestone (`feat/light-novel-editor`)

| Command | Latest evidence |
|---|---|
| `backend`: `$env:PUBLISHING_TEST_DATABASE='publishing_qa'; npm.cmd test` | 47 passed in five files, including the auth suite, document boundary validation and real 5,880-word structured persistence with legacy source preservation |
| `backend`: `npm.cmd run typecheck` and `npm.cmd run build` | Passed |
| `frontend`: `npm.cmd test` | 12 passed, including ambiguous creation recovery before applying later edits |
| `frontend`: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build` | Final checks passed |
| `frontend`: `npm.cmd run test:e2e` | Final six tests passed in headed Chromium (1.8 minutes), including file-drop/undo edge cases and the source document above 100 KiB |
| `frontend`: `npm.cmd run test:e2e -- illustrations.spec.ts` | Passed after file-drop deduplication. Exact drop/remove/undo/redo counts, invalid SVG rejection, file replacement, native mouse dragging, zero selection uploads, two confirmed uploads and exact reader order. |

The long-form journey now pastes more than 19,000 words and over 100 KiB of source text through the actual clipboard, exceeding the audited default request limit. It checks formatting, author notes, draft reopening, autosave, publication, semantic reader headings, no images/cloud requests, saved font/theme preferences, mobile width and restored reading progress. The autosave journey confirms first creation preserves the actual editor DOM node and focus, edits remain writable during a held save, later revisions reach the server, only one chapter exists, and mobile editing/navigation protection works.

The legacy publishing journey explicitly seeds a legacy-format draft, then uses the existing visual page editor, real cloud uploads, sorting and reopening. New chapter creation is covered by the structured studio journeys. Successful cloud assets are retained; no deletion occurs. Failed runs before upload create only isolated QA records.

Additional tests exposed duplicate file-drop handling across the editor event boundary; preventing repeated handling of the same native event fixed it. Undo/redo remains delegated to the engine. Earlier legacy browser assertions also assumed a create-route redirect would reopen an edit page; they now wait for save completion and explicitly reload before comparing remote URLs.

Representative screenshot artifacts (ignored by Git, recreated by the full browser suite):

- `frontend/test-results/novel-long-form-block-writ-cb8ae-sive-reading-without-images-chromium/studio-desktop.png`
- `frontend/test-results/novel-long-form-block-writ-cb8ae-sive-reading-without-images-chromium/reader-mobile.png`
- `frontend/test-results/autosave-autosave-creates--1d63c--made-during-a-pending-save-chromium/studio-mobile.png`

Desktop studio and mobile reader screenshots were visually inspected. The authoring engine is dynamically loaded; the main chunk remains about 800 kB / 249 kB gzip and the author-only chunk about 998 kB / 308 kB gzip. The build succeeds with chunk-size and existing DaisyUI/Node warnings. Full 100-file maximum-size stress and physical touch-device testing are not claimed.

## Author tier and entitlement milestone (`feat/author-memberships`)

5 November 2026, isolated QA schema only.

| Command | Observed result |
|---|---|
| `backend`: `$env:PUBLISHING_TEST_DATABASE='publishing_qa'; npm.cmd test` | 63 passed in seven files |
| `backend`: `npm.cmd run typecheck`, `npm.cmd run build` | Passed; no backend lint script is configured |
| `frontend`: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build` | Passed; 12 frontend tests. Existing chunk/CSS/Node warnings remain |
| `frontend`: `npm.cmd run test:e2e` | All seven headed Chromium journeys passed; six retained Cloudinary uploads across the two media journeys |

New real-MySQL checks cover concurrent tier creation, fixed prices and versioned admin audits, wrong-author/tier rejection, restricted parent/public child checks through warmed caches, scheduled releases, expired/future/overlapping legacy grants, suspended authors, redacted post feeds, cancellation ownership and paid-period retention. Pure policy tests cover chapter/post/chat consistency and exclude administrators from private chat eligibility without membership or author identity.

The new browser journey configures two author tiers and a tier-restricted post/chapter, verifies guest and lower-tier denials, exercises manual QA renewal cancellation, upgrades the isolated fixture to check authorized reads, restores optional authentication on full reload, injects session/profile 503 responses and verifies recovery, checks mobile width, and saves admin pricing policy. Manual fixture grants are not provider checkout evidence. Payment checkout and conversations are not yet implemented.

The optional-auth bug was reproduced because public feeds return 200 guest teasers, so response-triggered refresh alone never restored the saved session. Restoration now precedes those requests. Temporary service errors retain the saved identifier for retry; actual authentication failures clear it.

## Sandbox billing milestone (`feat/payment-donations`)

5 November 2026. Live Stripe sandbox: **UNVERIFIED**, credentials absent. No real financial transactions were performed.

| Command | Observed result |
|---|---|
| `backend`: `$env:PUBLISHING_TEST_DATABASE='publishing_qa'; npm.cmd test` | 78 tests passed in nine files, including 11 real-MySQL payment tests and four Stripe adapter contract tests |
| `backend`: `npm.cmd run typecheck`, `npm.cmd run build` | Passed |
| `frontend`: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build` | Passed; 12 component/service tests |
| `frontend`: `npm.cmd run test:e2e -- payment.spec.ts` | Headed fixture checkout/donation journey passed against the real API, raw signed webhook route and MySQL |
| `frontend`: `npm.cmd run test:e2e` | Final eight headed journeys passed in 1.6 minutes after the paid-period gap fix; six real Cloudinary test uploads retained, no deletion |

Payment regression covers missing configuration, server pricing/amount/currency validation, stable and conflicting checkout keys, expired and duplicate open checkouts, provider-timeout recovery, forged/mutated/stale/live signature rejection, HTTP RBAC, atomic rollback after provider lookup failure, duplicate event/payment IDs, absolute renewal periods, late events after cancellation, partial/full/repeated refunds, append-only adjustments, paid-period gaps, caller-owned cancellation, donation splits and both histories. The Stripe SDK HTTP transport is intercepted in adapter contract tests; no external Stripe requests are made.

The browser test explicitly labels payment simulation, checks chapter denial before fixture confirmation, delivers an SDK-signed event through the real webhook endpoint, verifies chapter access afterwards, records a donation, checks histories and cancels renewal without shortening paid access. Fixture routes exist only in the QA harness and are not in production `dist`.

The first harness run exposed a CommonJS import mismatch in the test provider; it was corrected. A test initially supplied unsupported book field names and omitted genre; it now uses the actual contract. Screenshot review also caught a capture made while the account guard was still loading; the mobile check now waits for the real payment-history content. These failed/incomplete checks are not external provider evidence.

## Member chat milestone (`feat/member-chat`)

5 November 2026. Tests use real loopback Socket.IO connections, JWT/session checks and the isolated MySQL database.

| Command | Observed result |
|---|---|
| `backend`: `$env:PUBLISHING_TEST_DATABASE='publishing_qa'; npm.cmd test` | Final 87 passed in ten files, including nine real MySQL/socket tests |
| `backend`: `npm.cmd test -- chat.integration.test.ts` with QA opt-in | Nine chat integration tests passed, including twelve repeated creation races and twelve concurrent retries |
| `backend`: `npm.cmd run typecheck`, `npm.cmd run build` | Final checks passed |
| `frontend`: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build` | Passed; 12 component/service tests |
| `frontend`: `npm.cmd run test:e2e -- chat.spec.ts` | Headed two-user chat journey passed |
| `frontend`: `npm.cmd run test:e2e` | Final nine headed Chromium journeys passed (1.9 minutes) after the in-transaction creation recheck and request timeout; six cloud test assets retained |

The initial concurrent conversation test exposed a real foreign-key deadlock. A targeted repeated first-creation test reproduced it, then passed after both participants acquired the same author parent lock. A later unread assertion selected the newest conversation after the stress test added others; it now selects the intended conversation ID. No race failure was dismissed as flakiness.

Chat checks cover participant/admin boundaries, trusted Origin, forged or wrong-identity tokens, actual websocket delivery, plain text, idempotent/conflicting sends, bounded rates, pagination, scoped monotonic reads, expired-member history/send/join/reconnect rejection, suppressed stale live delivery and revoked sessions. The browser also tests offline recovery, reload, lost committed acknowledgment with the same retry key and one database row, mobile width and expiry-driven UI denial. The actual mobile chat screenshot was visually inspected.

Artifacts are ignored under `frontend/test-results/`, including `chat-member-and-author-exc-9007d-s-and-lose-access-on-expiry-chromium/chat-mobile.png` and `payment-fixture-checkout-c-64fac-es-and-cancellation-persist-chromium/payments-mobile.png`. Focused runs replace prior artifacts. No external chat, email or financial service is used.

## Admin moderation milestone (`feat/admin-moderation`)

5 November 2026. All writes remain in the isolated QA schema.

| Command | Observed result |
|---|---|
| `backend`: `$env:PUBLISHING_TEST_DATABASE='publishing_qa'; npm.cmd test` | 97 passed in eleven files, including ten real-MySQL moderation tests |
| `backend`: `npm.cmd run typecheck`, `npm.cmd run build` | Passed; backend lint remains unconfigured |
| `frontend`: `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build` | Passed; 12 component/service tests |
| `frontend`: `npm.cmd run test:e2e -- moderation.spec.ts` | Final headed reader/admin/author workflow passed (26.6 seconds), including the deliberately delayed preview regression |
| `frontend`: `npm.cmd run test:e2e` | Final ten headed journeys passed (1.9 minutes); six cloud test assets retained |

Real database checks cover all admin route boundaries, credential-field omission, hiding warmed book/chapter bodies, public listing/TOC/count filtering, author republish resistance, post hiding, draft restoration, open-report deduplication, quotas, versioned reviews/settings, transactional audit reasons, account suspension/session revocation, pending-account activation denial, competing administrator suspensions and actual aggregate counts.

The browser reports a chapter, reviews it, hides/restores it, checks the author's notice and immediate reader visibility, suspends/restores the reader with old sessions still revoked, saves moderation settings, inspects audit and checks mobile content management. An initial select label included option text; explicit accessible names fixed the interaction. The mobile table is intentionally contained horizontally, keyboard focusable, and does not widen the page. Its screenshot was visually inspected at `frontend/test-results/moderation-reader-report-a-90099-spension-affect-real-access-chromium/admin-content-mobile.png`.

The preview regression holds an earlier response while selecting another chapter and checks that releasing it cannot replace the current preview. Endpoint-scoped result snapshots also prevent old filtered rows appearing under a new content type. No normal database migration or deployment was performed.

## Reader discovery and library milestone (`feat/reader-discovery`)

5 November 2026. Backend: 109 tests in thirteen files passed against isolated QA, including ten reader integration and two cursor tests; types and build passed. Frontend: 15 tests in four files, types, lint and build passed. Backend ESLint remains unconfigured. Focused discovery: two headed journeys passed (25.9 seconds). The final full twelve-journey Chromium run reports `status: passed` and no failed tests in Playwright's ignored `.last-run.json`; its terminal session was unavailable after context restoration, so no full-run duration is asserted.

Checks cover actual catalog/filter/pagination results, author profiles without books, private biography separation, username collision without cross-account writes, partial profile updates, idempotent follows/bookmarks, parent/chapter entitlements before history writes, equal-time cursors and revisits, unavailable-entry redaction/removal, JWT scope and real author counts. Three new asynchronous client tests first reproduced late profile/refresh restoration after logout and an old 401 clearing a newer login; generation guards make them pass.

The new browser journey publishes a book through the UI, discovers actual catalog data, bookmarks, follows/unfollows, resumes long-form reading, persists private profile settings, checks mobile width and theme reload, and verifies private account/author content disappears on logout. Another journey forces a profile 401 during reload and verifies restoration terminates without a recursive refresh deadlock. These new journeys make zero Cloudinary requests; the existing full suite intentionally creates retained cloud test assets. No normal database, real email or financial transaction is used.

Known bundle/DaisyUI/Node warnings remain non-failing. The main bundle is approximately 757 kB uncompressed / 233 kB gzip; the lazy author engine is approximately 998 kB / 308 kB. Maximum memory, physical touch devices and external Stripe/SMTP remain outside this evidence.

## Post spoilers/artwork milestone (`feat/author-posts-media`)

5 November 2026. Backend: 116 tests in fourteen files passed; types/build passed. Seven new real-MySQL tests cover post save replay/conflicts, purpose/ownership/confirmation/attachment checks, ordered removal/replacement, omitted-field compatibility, spoiler metadata and membership expiry. Migration 0011 applied and runner rerun successfully in QA. Frontend: 15 component/service tests passed; final types/lint/build passed. Backend lint remains unconfigured.

Focused headed post journey passed (15.2 seconds total runner time). Final full **thirteen headed Chromium journeys passed in 2.3 minutes**. The new journey intentionally loses the first committed create response, retries the same UUID, verifies one post and exactly two cloud uploads, reopens/reorders without uploads, checks unsaved navigation, reveals spoilers and verifies guest member-only body/image redaction. Eight cloud assets are created and retained per full run including earlier image journeys; failed earlier focused attempts also retained their uploads. Nothing was deleted.

An initial browser check caught an unstable controlled-textarea accessible name, fixed with an explicit label. Another test initially selected the sortable component's live region as the save status; both post journeys now select the named Post save progress region. A database fixture initially used a nonexistent period-start column and was corrected to the actual started_at schema. These failures were investigated before the passing full run.

The actual mobile post screenshot was inspected at `frontend/test-results/posts-optional-post-artwor-0fb45-espects-spoilers-and-access-chromium/post-mobile.png`. Text, spoiler controls and locked cards fit the viewport; the tiny upload fixtures verify delivery/order, not illustration aesthetics. No external payment, real email, normal database migration or cloud deletion occurred.

## Platform operations milestone (`feat/platform-operations`)

5 November 2026. Backend full suite: **125 passed in sixteen files** (34.27 seconds); types/build passed. Nine added checks cover migration locking/checksums/missing files, readiness/draining, Redis fallback/fail-closed auth and OpenAPI validation with the existing Swagger parser. Final documentation-only contract additions also passed both parser tests and types/build. Frontend types/lint passed; its 15 component tests are unchanged from the preceding verified milestone. The final full thirteen headed journeys passed (2.3 minutes), including local SMTP after upgrading Nodemailer to 10.3.1. An earlier run selected both payment confirmation and a concurrent loading status; the test now scopes the intended confirmation region before the passing rerun.

The complete Compose stack built and started in a separate project, `hibook-mvp-verification-20261105`, with random passwords in ignored `.env.compose.qa`, private persistent MySQL/Redis volumes, localhost application 8087 and Mailpit 8027. Actual binaries: MySQL **8.4.13**, Redis **8.10.3**, Node **24.22.2**. The original QA MySQL 8.0.21 and shared Redis were not stopped or changed by the outage test.

The final rebuilt-image journey passed via `frontend`: `$env:COMPOSE_QA_ALLOW_WRITES='1'; npm.cmd run test:compose` (**one headed journey, 17.5 seconds**). It registers two real local accounts through SMTP/Mailpit, grants an administrator via the operator CLI, approves an author, publishes and reads text without images, checks mobile width, renders Swagger, stops/restarts only its own Redis (readiness/login 503, guest discovery 200), recreates only its own backend, then verifies content and login restoration. Data also survived rebuilding/upgrading the stack. A first attempt used an incorrect reader route and was corrected to the existing `/comic/:slug/chapters/:chapterNo` contract.

A separate stateless `docker compose ... run --rm --no-deps -e MYSQL_HOST=127.0.0.1 backend` failed before listening with `[startup] connect ECONNREFUSED` and exit **1**, as expected. The running backend UID is **1000**; checks confirm `/app/.env` and `/app/tests` are absent. Both Dockerfiles exclude local environment and generated artifacts. Compose config validation and all documentation links passed. The mobile built-reader screenshot was visually inspected under ignored `frontend/compose-results/`.

`npm audit --json` reported backend **9 moderate, 0 high/critical** and frontend **12 moderate, 0 high/critical**. Audit exits 1 because advisories remain. No forced update was used. The local mail sink does not establish external SMTP/TLS delivery; Stripe sandbox remains externally unverified without credentials. No normal database migration, public deployment, real email or financial transaction was performed. Compose volumes and test assets are retained.

## UI and final implementation milestone (`refactor/ui-design-system`)

5 November 2026. Backend full suite: **127 passed in sixteen files** (37.61 seconds), types/build passed. New database coverage rejects malformed owned-book queries, proves deterministic pagination with tied timestamps, and retrieves older owned post artwork through bounded cursors. Frontend: **18 tests in five files passed**, types/lint/build passed. Added guard regressions preserve typed work through same-identity hydration and remove private contents on logout; another test clears an incompletely restored token after a profile outage while retaining its saved identity for retry.

The final full **fourteen headed Chromium journeys passed in 4.1 minutes**. The focused auth/interface run passed both journeys, and the focused restoration/discovery/membership run passed all three. The final full run includes **33 actual rendered axe-core states**, tagged WCAG A/AA through 2.2, plus keyboard skip focus, responsive widths, light/dark contrast and reduced motion. This is not a complete WCAG certification or physical screen-reader/touch-device audit.

The full run initially exposed a real parallel restoration race after sharing navigation: an access token could be used before profile verification completed. The interceptor now waits for restoration in flight, and a recoverable profile error clears the incomplete token without deleting its saved ID. Focused membership outage checks and the full suite then passed. Other discovered/fixed issues: unnamed recovery/password controls, ineffective Remember me, unstable guard remounts, ambiguous sign-in locators after adding shared navigation, low dark accent contrast (measured 3.59:1), and notification text fading through low-contrast intermediate states. No failing check was ignored or hidden behind an accessibility exclusion.

Screenshots were visually inspected at `frontend/test-results/interface-reader-author-an-b43b2-and-practical-accessibility-chromium/`: `author-desktop.png`, `author-tablet.png`, `author-mobile.png`, `author-dark-mobile.png` and `admin-policy-mobile.png`. The mobile metrics grid was compacted after inspection, and the updated light/dark mobile screenshots were inspected again. Representative reader/member/chat/admin screenshots from the existing journeys were also reviewed during their milestones.

The final frozen-source built Compose journey passed (**one headed journey, 22.6 seconds**) after rebuilding the completed UI: real local registration/SMTP, operator admin grant, author approval, block publishing, mobile reading, Swagger, isolated Redis outage/recovery and backend recreation. No cloud request was made by this deployment journey. Final local/deployed entry artifact and public editor-license checks were performed separately. Full QA image journeys create eight retained test assets per successful run; earlier failed attempts also retain their assets.

Final main JavaScript: approximately **409.02 kB / 132.55 kB gzip**, down from roughly 761 / 234; optional author engine **997.79 / 307.88** remains lazy. The non-failing engine-size, DaisyUI @property and Node/test-loader warnings remain. Root README setup/stack/architecture/features were checked against source and the built-stack workflow. Detailed engineering Markdown is under docs; the concise root README is the explicit requested exception.

The frozen-source Linux frontend was rebuilt once more after cleanup. Its entry is `index-Cr7nPBiL.js` (409,019 characters); the native Windows build entry is `index-DFKPbM0l.js` (approximately 409.02 kB). Platform build hashes differ, so no bit-for-bit cross-platform reproducibility is asserted. The built deployment is tested separately. Its public MPL license endpoint returns 200 and matches the license header. All relative Markdown links resolve.

## Final cross-module regression on merged main

Executed on `main` at **fc6f022b3580cf5a2d477a8f4933726a409b6534**, after all application milestones merged; the working tree was clean. Every delivered feature tip, including retained Q-FE, is an ancestor of main. `git ls-remote` confirmed all application branch hashes and origin/main. There were no conflicts.

| Directory / command | Final observed result |
|---|---|
| backend: `npm.cmd run typecheck` | Passed |
| backend: `$env:PUBLISHING_TEST_DATABASE='publishing_qa'; npm.cmd test` | **127 passed, sixteen files, 35.12 seconds**; real isolated MySQL/HTTP/Socket.IO/security/rollback/Redis checks included |
| backend: `npm.cmd run build` | Passed |
| backend lint | Not configured; no passing ESLint claim |
| frontend: `npm.cmd run typecheck` | Passed |
| frontend: `npm.cmd run lint` | Passed |
| frontend: `npm.cmd test` | **18 passed, five files, 6.24 seconds** |
| frontend: `npm.cmd run build` | Passed; main 409.02 kB / 132.55 gzip, optional engine 997.79 / 307.88 |
| frontend: `npm.cmd run test:e2e` | **Fourteen headed journeys passed in 3.8 minutes**, including 33 rendered axe states |
| frontend: `$env:COMPOSE_QA_ALLOW_WRITES='1'; npm.cmd run test:compose` | **One headed built-stack journey passed in 25.1 seconds** |
| Git and docs | Clean main; no whitespace errors; relative documentation links resolve; all feature tips merged and remotes confirmed |

The final source passes all ten requested journey categories across these tests: registration/discovery/reading/progress; author onboarding; long-form zero-image and illustrated publication; member checkout/access separation; donation histories; persisted/reconnecting chat; moderation; unauthorized/session/payment/upload security; responsive accessibility; and built local deployment. Payment journeys remain deterministic provider simulation, not external Stripe evidence. Cloudinary image journeys use real uploads and retain their resources. Local SMTP is real but uses sinks. No normal database rollout or public deployment is implied.

The subsequent release-record commit changes documentation only; application code remains the verified merged-main tree. Non-failing build warnings and the remaining external/dependency/media/privacy/operational limits above remain explicitly recorded.
