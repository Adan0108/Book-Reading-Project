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
