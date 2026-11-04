# Test results and evidence

Date: 4 November 2026 (Australia/Sydney). Audited commit: `82b4bf93a16242ce04d4ecd20b09d664d8af376b`, branch `main`.

## Scope and safety

Normal application databases were not migrated or modified. Tests used the previously created MySQL 8.0.21 container `book-publishing-qa-20261104`, schema `publishing_qa`, localhost port 3307, and existing local Redis. Fresh test users, books, memberships, applications and OTPs were created there. No Redis flush was performed. Only test-specific keys were used for revocation/counters/cache.

QA backend startup used the existing `backend/tests/serve-qa.cjs`, which explicitly overrides database configuration to the isolated schema. SMTP was overridden to localhost with blank credentials so real email could not be delivered. The expected local SMTP verification error is **not** counted as a successful email integration test. Browser Cloudinary requests were intercepted and aborted. No cloud asset was created/deleted, no real payment or sandbox financial transaction was processed.

Application source, test suites, dependencies and configuration were not edited. Supplementary audit script/output live under `docs/mvp-audit/`; they are evidence/reproduction material, not production endpoints or replacement tests.

## Exact commands run

Commands use Windows PowerShell and `npm.cmd`, because this machine blocks unsigned `npm.ps1`. Elevation was used for compiler/browser/Docker/network access; TLS verification was not disabled and no execution policy was changed.

| Working directory | Command | Actual result |
|---|---|---|
| Repository | `git -c safe.directory='C:/Users/MSI/Documents/Personal Project/Book Reading Project' status -sb` | On `main`, tracking origin/main; documentation moves are the existing uncommitted changes. |
| Repository | `docker start book-publishing-qa-20261104` | Passed; starts isolated QA DB only. |
| Repository | `docker compose -f backend/docker/docker-compose.yml config --quiet` | Passed; obsolete `version` field warning. Does not prove a clean full-stack deployment. |
| Frontend | `npm.cmd run typecheck` | Passed (`tsc -b`). |
| Frontend | `npm.cmd run lint` | Passed. |
| Frontend | `npm.cmd test` | **11 passed**, 3 component/service test files. |
| Frontend | `npm.cmd run build` | Passed; large JS bundle ~786 KB / ~244 KB gzip, DaisyUI `@property` and Node loader warnings. |
| Backend | `npm.cmd run typecheck` | Passed (`tsc --noEmit`). |
| Backend | `$env:PUBLISHING_TEST_DATABASE='publishing_qa'; npm.cmd test` | **25 passed**, 3 files, including 7 real MySQL integration cases. |
| Backend | `npm.cmd run build` | Passed; TypeScript compilation and copied docs/templates/migrations. |
| Backend | Backend lint | Not run: no backend lint script/config is present. |
| Backend | `$env:EMAIL_HOST='127.0.0.1'; $env:EMAIL_PORT='1'; $env:EMAIL_USER=''; $env:EMAIL_PASSWORD=''; node tests/serve-qa.cjs` | QA API started on localhost:3000 with real MySQL and Redis; expected disabled SMTP verification error. |
| Frontend | `npm.cmd run dev -- --host localhost` | Vite started on localhost:8000. |
| Repository | `node --check docs/mvp-audit/verify-mvp.cjs` | Syntax validation passed. |
| Repository | `node docs/mvp-audit/verify-mvp.cjs` | Headed Chromium text-only journey and HTTP probes completed; evidence includes both good behavior and confirmed defects. |
| Repository | `node docs/mvp-audit/verify-mvp.cjs --refresh-only` | Bounded repetition records timing-dependent concurrent-refresh outcomes; see `repeatAttempts` in evidence. |
| Repository | `node docs/mvp-audit/verify-mvp.cjs --markdown-only` | Rechecked script, inline image-event and JavaScript-link payloads inside the actual rendered Markdown container. |
| Frontend/backend separately | `$auditReport = npm.cmd audit --json \| ConvertFrom-Json; $auditReport.metadata.vulnerabilities \| ConvertTo-Json -Compress` | Frontend: 12 moderate, 0 high/critical. Backend: 9 moderate, 1 high, 0 critical. No dependency changes. |

The npm audit wrapper prints JSON even when npm reports advisories; its successful shell execution must not be read as a clean vulnerability audit. The existing high backend advisory concerns Nodemailer; this audit did not upgrade or test live SMTP.

## Live probe observations

Full sanitized values are in [EVIDENCE.json](EVIDENCE.json). The script records observations intentionally; security flaws do not become “passed tests” just because the reproduction completed.

| Scenario | Observed | Interpretation |
|---|---|---|
| `TEXT_E2E` | 27,166 bytes, exact draft/edit source, 0 images, 0 Cloudinary requests; semantic heading/emphasis; mobile no overflow | Basic text-only author→reader journey works. |
| Reader typography | Heading 16px/400, paragraph 16px/24px and bottom margin 0px | Semantic Markdown exists, novel typography not finished. |
| `LONG_TEXT_LIMIT` | 112,640-byte content rejected 413 | Implicit transport limit, despite LONGTEXT DB column. |
| `MEMBERSHIP_BOUNDARIES` | Guest 401; nonmember, foreign-author, expired, cancelled and low tier 403; active allowed tier 200 | Chapter-level boundary passes tested manually seeded entitlement cases. |
| Member TOC | Member can read tier chapter but TOC says locked | Routed TOC lacks optional auth; frontend hints disagree with content authorization. |
| `PUBLIC_TO_PAID_CACHE` | Warm public content 200 → guest 401 after API visibility update | Tested cache does not bypass current chapter gate. |
| `SCHEDULE_COLUMN` | Scheduled date stored; chapter remains draft with no published timestamp | Storage works; not evidence of automated release. |
| `BOOK_VISIBILITY` | MEMBERS book + PUBLIC chapter returns guest 200 | Book restriction not inherited; policy/control gap. |
| `SETUP_WITHOUT_PROOF` | Setup 201 without OTP/setup proof/cookie for pending verified fixture | Confirmed caller-binding defect. |
| `OTP_LIMITS` | Recent resend 400; ten wrong attempts 401; correct OTP afterward 400 | Per-account cooldown and invalidation work for a seeded OTP. Delivery and complete registration still unverified. |
| `RESET_SESSION_REVOCATION` | Reset 200, old AT 200, old RT refresh 200 | Confirmed reset revocation defect. |
| `LOGOUT_REVOCATION` | Logout 200, immediate old AT/RT both 401 | Immediate revocation works; full lifetime guarantee is a separate code-derived concern. |
| `JWT_ALGORITHM` | HS256 | Explicit asymmetric JWT requirement unmet. |
| `CONCURRENT_REFRESH` | Earlier paired requests both 200; another run 200/401 | Timing-dependent race; sequential old-token reuse is 401. Bounded repeat outcomes retained in evidence. |
| `BLOCKED_EXISTING_SESSION` | Blocked user’s existing AT returns 200 | Blocking does not revoke existing sessions. |
| `MARKDOWN_SAFETY` | No executable content scripts, no `javascript:` links, execution marker 0 | Tested raw-script/link payload blocked; no universal XSS claim. |
| `DISCOVERY` | Title search finds fixture, author-book list 200, invalid page 500 | API search works; validation weak; generated home catalog remains disconnected. |
| `AUTHOR_APPROVAL` | Submit 201, approve 200, authors rows 0, publishing 403; reader admin list 403, admin list 200 | Admin API role guard works; approval-to-author integration broken. |
| `HIDDEN_BOOK_CACHE` | Direct QA SQL hide leaves cached detail 200, chapter content 404 | Stale metadata after out-of-band changes, not content-gate bypass. Normal author API invalidates cache; admin moderation API is missing. |

## Coverage boundaries

Existing 25 backend tests validate publishing file metadata, quotas, signatures, asset confirmation, ownership, idempotency, rollback, page ordering, legacy Markdown, cover replacement and HTTP upload guards. Existing 11 frontend tests cover local selection/drop/preview, replacement/removal/cleanup, reorder buttons, upload retries/concurrency and save lifecycle/navigation. These suites are valuable but do not cover the full MVP.

The audit added runtime observations rather than changing those assertions or fixing application defects. The browser journey used real UI, real authentication, real Express/MySQL/Redis and no image uploads. Membership rows were inserted directly as isolated fixtures; they do **not** imply purchase, renewal or webhook processing exists.

The repository's existing `npm.cmd run test:e2e` image-publishing suite was **not rerun during this audit**, because it creates live Cloudinary assets. Its two passing cases from the preceding publishing/merge work are historical evidence in [the publishing report](../publishing/PUBLISHING_REPORT.md), not new text-first/full-MVP verification. The current audit used Playwright headed Chromium through the reproduction script instead.

Not exercised: real email delivery/signup/reset inbox journey, sandbox or live payments, donations, real-time chat, admin moderation (no implementations), normal database deployment/migrations, maximum-size image chapters, mobile touch sorting, full accessibility/penetration/load testing, multi-day RT replay, timed scheduler transitions or financial reconciliation. Mark these missing or unverified as appropriate; do not call them complete.

## Reproduction prerequisites and cleanup

Use the dedicated QA container and schema referenced above; do not substitute the normal application database. Build backend first. Start the two local servers as listed, run the reproduction script, then stop those processes and the QA container. The script checks `DATABASE()='publishing_qa'`, always connects to localhost:3307, and retains fixtures for inspection. It does not delete rows/resources.

Documentation link checks, Markdown-location inventory, application-source diff checks, and final Git status are performed after writing reports. All project Markdown belongs under `docs/`; third-party `node_modules` documentation and generated build/test artifacts are excluded from that requirement.

Final checks passed: **12 project Markdown files under docs, seven audit reports, 17 recorded probe scenarios, no broken local Markdown links, no application code changes**, and `git diff --check` clean. QA API/Vite processes and the QA MySQL container were stopped; test data was retained, and unrelated services were left running.

Final working-tree status (documentation moves/additions only):

```text
## main...origin/main
 D PUBLISHING_REPORT.md
 D Readme.md
 D backend/src/tests/mysql/slq.md
 D frontend/README.md
?? docs/
```

The deleted paths are the originals relocated into `docs/`, not discarded documents. Git has not been staged, committed, pushed or merged during this audit. HEAD remains `82b4bf93a16242ce04d4ecd20b09d664d8af376b`.
