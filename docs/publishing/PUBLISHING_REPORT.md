# Author publishing audit and implementation report

Date: 4 November 2026 (Australia/Sydney). Branch: `Q-FE`.

The implementation and live publishing workflow are verified locally. No commit, push, branch switch, reset, merge, destructive migration, or Cloudinary deletion was performed. The original working tree was clean. Git commands used a command-scoped `safe.directory` setting because the sandbox account differs from the repository owner; global Git configuration was not changed.

## 1. Initial audit

| Area | Original implementation | Problem / severity | Implemented fix |
|---|---|---|---|
| Book covers | Separate create/edit URL inputs | High: authors needed external hosting | Shared local file picker, drop area, replace/remove and preview |
| Chapter images | Markdown URL textarea; buffered fan-art endpoint | High: no deferred visual editing or ordered page relationship | Visual local editor, direct signed upload, ordered asset references |
| Editor | Duplicated forms; no upload states | High: no reliable draft/publish lifecycle | Shared editor, progress, disabled submission, retry retention, navigation protection |
| Cloudinary | Multer upload stream and URL-based legacy deletion | High: unsuitable for requested direct flow; no intent confirmation | Separate protected authorization/confirmation endpoints; legacy endpoints preserved |
| Database | `content_md` and unrelated unordered fan-art rows | High: no transactional ordered page management | Additive assets, chapter images, covers, and idempotency tables |
| Permissions | Existing authentication/roles and author ownership | High: chapter update did not enforce the URL book/chapter relationship | Author and book locks, exact chapter scope, ownership/purpose/attachment checks |
| Reader | Markdown shown literally in a `<pre>` | High: image links were not rendered | Ordered image rendering and safe Markdown renderer; raw HTML disabled |
| Session | Memory-only request token; home always rotated refresh token | High: full navigation lost auth; navigation could abort a rotating refresh | Restore existing saved token, single-flight interceptor refresh, profile check on home |
| Tests/build | Manual backend samples; no automated feature suite; unused imports blocked frontend build | High: no publishing regression evidence | Component, service, HTTP, real MySQL and headed browser tests; fix existing lint/type blockers |

The existing `fan_arts` table is associated with chapters. It is retained with its existing API and data. It was not treated as a new community feature or destructively migrated. New publishing pages use a distinct ordered relationship rather than changing the meaning of existing fan-art records.

## 2. Architecture

Selection, replacement, removal and sorting operate on browser `File` objects and stable local IDs. Object URLs are created on selection and revoked on removal, replacement and unmount. Existing remote images remain visible and are not uploaded again. Image previews decode asynchronously and offscreen cards load lazily.

```mermaid
sequenceDiagram
    actor Author
    participant Browser
    participant API
    participant Cloudinary
    participant MySQL
    Author->>Browser: Choose/drop images; preview and reorder locally
    Note over Browser: No upload on selection; retain File objects
    Author->>Browser: Save Draft / Publish
    Browser->>API: Authenticate and authorize each remaining new file
    API->>MySQL: Check ownership and quota; record opaque intent
    API-->>Browser: Server-assigned public ID, signed parameters, public config
    Browser->>Cloudinary: Direct multipart upload (three workers maximum)
    Browser->>API: Confirm opaque intent ID
    API->>Cloudinary: Admin API lookup of stored public ID
    API->>MySQL: Record verified immutable asset metadata
    Browser->>API: Save ordered asset IDs and stable request ID
    API->>MySQL: Transaction: chapter/book, references, publication state, replay result
    MySQL-->>API: Commit
    API-->>Browser: Confirm saved/published result
```

The Cloudinary API secret stays on the backend. The browser receives only public configuration and signed upload parameters. New uploads never pass through Multer or backend buffers. The existing Multer dependency remains for legacy endpoints.

Upload policy: JPEG/PNG/WebP, maximum 10 MiB per image, 100 pages per chapter, 500 authorizations per author per day, 120 authorizations per minute, and 120 unconfirmed asset-verification requests per author per minute. Authorization quotas use database rows under an author lock; verification throttling uses Redis. Signed intents expire after one hour. Expiry is compared using MySQL's clock, avoiding client/server timezone interpretation differences.

Uploads run with three workers. Each stage gets at most one automatic retry with a 750 ms delay. Request timeouts are 30 seconds for application requests and 120 seconds for Cloudinary upload. Retries retain successful asset IDs; an ambiguous upload first attempts confirmation of the existing intent, avoiding a duplicate successful upload. Partial failures preserve local files and successful uploads for a manual retry. Expired intents require replacing/selecting the image again.

Confirmation accepts no client URL or public ID. It looks up the server-issued public ID through Cloudinary and checks the resource type, delivery type, format, size limit, integer dimensions, maximum pixel count, page count and Cloudinary asset identity. Cloudinary can normalize source bytes: the live 68-byte PNG became 67 bytes, so exact input/output byte equality is deliberately not required. The signed preset enforces a provider-side size cap as well.

Save/publish requests lock the author and target book, validate exact chapter scope and confirmed assets, and transactionally update content, page order, covers and publication state. A stable request ID plus payload hash prevents duplicate creation and rejects conflicting reuse. Drafts can be empty; publication requires text or pages and sets the publication timestamp. Reader endpoints enforce published state and release time before returning content. Existing access tiers continue to use the existing membership checks.

## 3. Database and API contracts

All endpoint paths below are relative to `/v1/api` and retain the project's success envelope `{message,status,metadata}`.

| Endpoint | Request | Successful metadata |
|---|---|---|
| `POST /upload/fan-art/authorize` | `{purpose:"cover"\|"chapter", mimeType, size, bookId?}`; chapter purpose requires an owned book | `{id,cloudName,apiKey,params,signature}`; params contain timestamp, server public ID, overwrite=false, signed preset and allowed formats |
| `POST /upload/fan-art/confirm` | `{assetId: <opaque intent UUID>}` | `{id,imageUrl}`; repeat confirmation is safe |
| `POST /authors/me/books` | Existing book fields plus `coverAssetId?`, `removeCover?`, `requestId` | `{id,slug}` |
| `PATCH /authors/me/books/:bookId` | Partial existing fields plus confirmed `coverAssetId?`, `removeCover?`, `requestId` | `{id,slug}` |
| `POST /authors/me/books/:bookId/chapters` | `{title,contentMd?,visibility?,isDraft?,imageAssetIds?,requestId}` plus legacy metadata fields | `{chapterId,chapterNo,bookId,slug}` |
| `PATCH /authors/me/books/:bookId/chapters/:chapterId` | Partial fields with ordered `imageAssetIds?` and `requestId` | `{chapterId,chapterNo,bookId,slug}` |
| Existing author and reader chapter GET endpoints | Existing routes | Add `images: [{id,imageUrl,pageOrder}]`; keep `contentMarkdown` |

The new UI always supplies a UUID v4 request ID and reuses it after an ambiguous save failure. Legacy write callers may omit it; those requests receive a server-generated ID and do not gain cross-request duplicate protection. Existing remote covers may remain unchanged or be removed. Newly supplied arbitrary cover URLs are rejected; replacement must use a confirmed upload. Browser blob URLs are never submitted as persisted image references. Legacy Markdown remains stored as text and rendered safely; the application does not fabricate Markdown for new page images.

The additive migration `backend/src/migrations/20261104_0001_publishing.sql` creates:

- `publishing_assets`: author/book scope, purpose, intent UUID, server public ID, expected source metadata, verified cloud identity/URL, confirmation time and expiry.
- `chapter_images`: chapter foreign key, unique asset reference, positive application-generated page order, primary key `(chapter_id,page_order)`.
- `book_covers`: one confirmed asset reference per book.
- `publishing_requests`: unique `(author_id,request_id)`, payload hash and committed JSON result.

Existing Markdown, fan-art rows, book/chapter IDs and reader URLs are preserved. The migration was applied and rerun successfully in the isolated QA schema. No migration was run against the normal configured database, which refused connections in this environment. Existing startup migration infrastructure applies the additive file when that database becomes available.

Environment requirements: existing `MYSQL_*`, `REDIS_HOST`, `REDIS_PORT`, `FRONTEND_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`; new server-only `CLOUDINARY_PUBLISHING_PRESET`. No frontend Cloudinary secret or preset fields are needed in the author UI.

Created signed preset `book_publishing_signed_v1` with JPEG/PNG/WebP, `max_file_size=10485760`, `overwrite=false`, no incoming transformations, and server-selected public IDs. Added its name to ignored local `backend/.env` and documented it in `.env.example`. Existing credentials were neither printed nor changed. In another Cloudinary account, create an equivalent signed preset and configure its name.

## 4. Tests and exact commands

Use `npm.cmd` on this Windows installation: PowerShell blocks the unsigned `npm.ps1` wrapper. Compiler/browser tools needed the account permissions supplied by elevated execution; no execution policy was changed.

| Category | Working directory and command | Result |
|---|---|---|
| Frontend component/service | `frontend`: `npm.cmd test` | 11 tests, 3 files, passed |
| Backend unit/HTTP plus real integration | `backend`: `$env:PUBLISHING_TEST_DATABASE='publishing_qa'; npm.cmd test` | 25 tests, 3 files, passed; includes 7 real MySQL tests |
| Frontend types | `frontend`: `npm.cmd run typecheck` | Passed |
| Backend types | `backend`: `npm.cmd run typecheck` | Passed |
| Frontend lint | `frontend`: `npm.cmd run lint` | Passed |
| Backend lint | No repository backend ESLint script/config exists | Not run; strict TypeScript and tests passed |
| Frontend production | `frontend`: `npm.cmd run build` | Passed |
| Backend production | `backend`: `npm.cmd run build` | Passed; runtime docs, templates and migrations are copied into dist |
| Headed Chromium | `frontend`: `npm.cmd run test:e2e` | 2 passed; live API, real auth, real MySQL, real Cloudinary |
| Schema/migrations | Integration suite calls `runMigrationsOnce()` twice | Passed on MySQL 8.0.21 |
| Read-only reconciliation | `backend`: `node scripts/publishing-orphans.cjs` with isolated QA `MYSQL_*` environment | Passed; `{action:"review-only",candidates:[]}` |
| Git whitespace | Repository root: `git diff --check` with command-scoped safe.directory | Passed |

Frontend tests cover multiple selection, local preview allocation, drop input, invalid/oversized files, stable previews on reorder, numbering, replacement, removal, unmount cleanup, existing cover behavior, disabled editing during save, existing asset retention, ambiguous upload confirmation, failure retention, three-worker concurrency, create/edit hydration, duplicate-submit protection, publish sequencing, save-key reuse and unsaved navigation protection.

Backend tests cover invalid metadata/purpose/IDs, author restrictions, quotas, signed destination parameters, verification and provider failures, duplicate confirmation, expiry, foreign assets, image-only publication, empty drafts, publication validation, ordering, scoped updates, rollback and arbitrary cover rejection. Real database tests additionally cover concurrent duplicate requests, conflicting request reuse, migration reruns, reorder/removal, unpublish/republish, partial legacy updates, safe cover replacement, actual constraint rollback and cross-author rejection. HTTP tests use real authentication middleware with deterministic key/role/Redis fixtures.

The headed live workflow creates a book, chooses a cover, verifies zero Cloudinary POST requests on selection, saves a draft, reopens, replaces the cover, publishes the book, creates a chapter, drops three images, sorts with an actual mouse drag and keyboard handle, uses move buttons, removes an image, saves/reopens a draft, publishes, edits/reorders an already-published chapter without re-uploading, and verifies exact reader image order. It also checks mobile reader width, renders a legacy Markdown image, and checks unauthenticated HTTP rejection. The final main workflow observed exactly four direct Cloudinary upload POSTs: two covers and two retained chapter pages. Removed pages were not uploaded. These were real cloud requests, not mocks.

QA setup used an isolated container `book-publishing-qa-20261104`, schema `publishing_qa`, bound to localhost port 3307, and the already-running local Redis. No Redis flush or unrelated-container changes were made. The normal application MySQL configuration was not repointed. To reproduce integration/E2E tests, start that retained QA container (or create the equivalent isolated MySQL fixture), run the backend build, then run the commands above. Playwright installs Chromium with `npx.cmd playwright install chromium`; headed mode is the default, with `PW_HEADLESS=1` available for CI.

The QA MySQL container was stopped after verification, with its data retained. Cloudinary test assets and the signed preset were retained; none were deleted.

## 5. Reliability review and remaining issues

- New publication, upload, sorting and reader workflows passed all described checks. No known failing publishing test remains.
- The normal configured MySQL service was unavailable. Integration and browser evidence uses the isolated real MySQL database, not the owner's existing data. Deployment and migration against that existing database remain the owner's operational step.
- Abandoned or replaced Cloudinary assets are retained deliberately. `scripts/publishing-orphans.cjs` produces a read-only review manifest for unreferenced intents older than a day (up to 1000 rows). No automatic deletion job is installed because the task prohibits unapproved cloud deletion. Future deletion must also check legacy URL references, elapsed signature lifetime and all persisted consumers. Reconciliation candidates are not proof an asset is safe to delete.
- Local files survive recoverable save failures within the mounted editor; they are not durable across closing the tab, browser crashes, or an approved discard. Navigation protection warns users. There is no IndexedDB/offline-resume implementation.
- Up to 100 full source files can remain selected. Lazy previews and bounded upload workers reduce load, but large chapters can still consume substantial browser memory. Maximum-size chapter stress testing and mobile touch-device automation were not performed. Desktop mouse/keyboard sorting and mobile reader layout were tested.
- Successful uploads whose save never completes, and assets replaced by covers/pages, can accumulate until reviewed. Idempotency and intent rows also currently have no scheduled retention purge.
- Compatible `npm audit fix` updates removed all reported critical vulnerabilities and all frontend high vulnerabilities. Final reported advisories: frontend 12 moderate tooling/transitive issues; backend 9 moderate and 1 high. Backend high is existing Nodemailer; its recommended fix requires a major upgrade outside this publishing change. Do not interpret a passing publishing suite as a complete mail-system/security audit. No forced major upgrade was applied.
- Frontend build reports a large main bundle (about 786 kB uncompressed / 244 kB gzip) and a DaisyUI `@property` optimization warning. The build succeeds. Route splitting is a future performance improvement. Build-time Node deprecation and test-config loader warnings are non-failing.
- Existing buffered fan-art endpoints and their legacy deletion behavior remain for compatibility; the new editor never uses them. The new publishing lifecycle performs no cloud deletion.
- SMTP and email delivery were not tested; no outgoing messages were sent to real users. No application deployment was performed.

## 6. Files changed

The generated file table below lists implementation, tests and the small existing-code lint/type corrections needed to run repository validation. Package locks include compatible security updates.

| File | Change | Reason |
|---|---|---|
| `docs/publishing/PUBLISHING_REPORT.md` | Audit, API, test and operations report | Review evidence and documented limitations |
| `backend/.env.example` | Document signed publishing preset | Server-only upload configuration |
| `backend/package-lock.json` | Lock editor/test dependencies and compatible security updates | Reproducible dependencies and reduced advisories |
| `backend/package.json` | Add test/type scripts and required dependencies | Run automated feature and build verification |
| `backend/scripts/copy-assets.cjs` | Copy production runtime assets | Make built server documentation/templates available |
| `backend/scripts/publishing-orphans.cjs` | Read-only unreferenced-asset manifest | Safe manual reconciliation without cloud deletion |
| `backend/src/auth/checkAuth.ts` | Return 401 for malformed access tokens | Consistent authentication rejection |
| `backend/src/migrations/20261104_0001_publishing.sql` | Add four publishing tables with keys/indexes | Retain legacy data and store ordered assets |
| `backend/src/models/repositories/chapter.repo.ts` | Enforce release availability in reader queries | Prevent draft/future content exposure |
| `backend/src/routes/upload/index.ts` | Protected authorize and confirm endpoints | Author-only signed upload flow |
| `backend/src/services/book.service.ts` | Delegate writes; return ordered reader/author images | One save lifecycle with legacy content compatibility |
| `backend/src/services/publishing.service.ts` | Intent authorization, asset confirmation and transactional saves | Secure direct uploads, ordering and idempotency |
| `backend/tests/database.integration.test.ts` | Automated publishing regression coverage | Verify lifecycle, security and failure behavior |
| `backend/tests/publishing.test.ts` | Automated publishing regression coverage | Verify lifecycle, security and failure behavior |
| `backend/tests/serve-qa.cjs` | Seed and serve an isolated QA database | Test real auth without modifying the normal database |
| `backend/tests/upload.http.test.ts` | Automated publishing regression coverage | Verify lifecycle, security and failure behavior |
| `backend/vitest.config.ts` | Configure deterministic test environment | Run component/service and backend suites |
| `frontend/.gitignore` | Ignore browser test artifacts | Keep generated traces/screenshots out of source control |
| `frontend/e2e/publishing.spec.ts` | Real author-to-reader browser workflow and auth rejection | Verify live Cloudinary, sorting, persistence and legacy rendering |
| `frontend/package-lock.json` | Lock editor/test dependencies and compatible security updates | Reproducible dependencies and reduced advisories |
| `frontend/package.json` | Add test/type scripts and required dependencies | Run automated feature and build verification |
| `frontend/playwright.config.ts` | Headed Chromium with isolated backend and frontend servers | Reproducible real-service E2E coverage |
| `frontend/src/App.tsx` | Protect author routes | Check author access before displaying forms |
| `frontend/src/features/author/AuthorGuard.tsx` | Author access guard with loading/error/retry | Use backend role/ownership policy |
| `frontend/src/features/author/ImageEditor.test.tsx` | Automated publishing regression coverage | Verify lifecycle, security and failure behavior |
| `frontend/src/features/author/ImageEditor.tsx` | Local file/drop visual editor with sortable cards | Selection, replacement, removal and accessible ordering |
| `frontend/src/features/author/PublicationEditor.test.tsx` | Automated publishing regression coverage | Verify lifecycle, security and failure behavior |
| `frontend/src/features/author/PublicationEditor.tsx` | Shared book/chapter create/edit experience | Draft/publish progress, retry retention and unsaved protection |
| `frontend/src/features/author/images.test.ts` | Automated publishing regression coverage | Verify lifecycle, security and failure behavior |
| `frontend/src/features/author/images.ts` | Typed local-image lifecycle and bounded direct-upload service | Avoid early uploads, leaks and duplicate successful uploads |
| `frontend/src/features/author/publicationService.ts` | Centralize author load/save requests | Keep API details out of page forms |
| `frontend/src/lib/axios.ts` | Restore saved token, share refresh and fix production base path | Preserve sessions through navigation |
| `frontend/src/main.tsx` | Use a data router | Support unsaved-work navigation blocking |
| `frontend/src/pages/AuthorDashboardPage.tsx` | Correct existing unused imports, component names or concrete types | Pass repository lint/type checks without changing unrelated feature behavior |
| `frontend/src/pages/AuthorProfilePage.tsx` | Correct existing unused imports, component names or concrete types | Pass repository lint/type checks without changing unrelated feature behavior |
| `frontend/src/pages/BookDetailPage.tsx` | Correct existing unused imports, component names or concrete types | Pass repository lint/type checks without changing unrelated feature behavior |
| `frontend/src/pages/ChapterReadingPage.tsx` | Render ordered images and safe Markdown | Support new chapters and legacy image links |
| `frontend/src/pages/CreateBookPage.tsx` | Replace duplicate forms with shared editor entry point | Reuse local-first upload and publishing behavior |
| `frontend/src/pages/CreateChapterPage.tsx` | Replace duplicate forms with shared editor entry point | Reuse local-first upload and publishing behavior |
| `frontend/src/pages/EditBookPage.tsx` | Replace duplicate forms with shared editor entry point | Reuse local-first upload and publishing behavior |
| `frontend/src/pages/EditChapterPage.tsx` | Replace duplicate forms with shared editor entry point | Reuse local-first upload and publishing behavior |
| `frontend/src/pages/Forgot/email.tsx` | Correct existing unused imports, component names or concrete types | Pass repository lint/type checks without changing unrelated feature behavior |
| `frontend/src/pages/Forgot/password.tsx` | Correct existing unused imports, component names or concrete types | Pass repository lint/type checks without changing unrelated feature behavior |
| `frontend/src/pages/HomePage/ComicCard.tsx` | Correct existing unused imports, component names or concrete types | Pass repository lint/type checks without changing unrelated feature behavior |
| `frontend/src/pages/HomePage/ComicGrid.tsx` | Correct existing unused imports, component names or concrete types | Pass repository lint/type checks without changing unrelated feature behavior |
| `frontend/src/pages/HomePage/FeaturedSlider.tsx` | Correct existing unused imports, component names or concrete types | Pass repository lint/type checks without changing unrelated feature behavior |
| `frontend/src/pages/HomePage/Footer.tsx` | Correct existing unused imports, component names or concrete types | Pass repository lint/type checks without changing unrelated feature behavior |
| `frontend/src/pages/HomePage/Header.tsx` | Correct existing unused imports, component names or concrete types | Pass repository lint/type checks without changing unrelated feature behavior |
| `frontend/src/pages/HomePage/HomePage.tsx` | Check profile instead of rotating valid sessions | Avoid token invalidation during navigation |
| `frontend/src/pages/HomePage/SideDecorations.tsx` | Correct existing unused imports, component names or concrete types | Pass repository lint/type checks without changing unrelated feature behavior |
| `frontend/src/pages/HomePage/Sidebar.tsx` | Correct existing unused imports, component names or concrete types | Pass repository lint/type checks without changing unrelated feature behavior |
| `frontend/src/pages/HomePage/TopTrending.tsx` | Correct existing unused imports, component names or concrete types | Pass repository lint/type checks without changing unrelated feature behavior |
| `frontend/src/pages/SignUp/OTP.tsx` | Correct existing unused imports, component names or concrete types | Pass repository lint/type checks without changing unrelated feature behavior |
| `frontend/src/pages/SignUp/SignUpPage.tsx` | Correct existing unused imports, component names or concrete types | Pass repository lint/type checks without changing unrelated feature behavior |
| `frontend/src/store/useAuthStore.ts` | Remove credential logging and clear persisted logout tokens | Retain existing auth while improving session safety |
| `frontend/src/store/useBookStore.ts` | Replace loose/error types and remove unsafe casts | Pass lint and preserve store behavior |
| `frontend/src/test/setup.ts` | Configure deterministic test environment | Run component/service and backend suites |
| `frontend/src/type/book.ts` | Add ordered image and author dashboard fields; normalize tag types | Align frontend contracts |
| `frontend/vitest.config.ts` | Configure deterministic test environment | Run component/service and backend suites |

## 7. Git status

No commit or push was performed. The following is the final working-tree snapshot; untracked files are intentionally left available for manual review and commit.

```text
git branch --show-current
Q-FE
```

```text
git status --short
M backend/.env.example
 M backend/package-lock.json
 M backend/package.json
 M backend/src/auth/checkAuth.ts
 M backend/src/models/repositories/chapter.repo.ts
 M backend/src/routes/upload/index.ts
 M backend/src/services/book.service.ts
 M frontend/.gitignore
 M frontend/package-lock.json
 M frontend/package.json
 M frontend/src/App.tsx
 M frontend/src/lib/axios.ts
 M frontend/src/main.tsx
 M frontend/src/pages/AuthorDashboardPage.tsx
 M frontend/src/pages/AuthorProfilePage.tsx
 M frontend/src/pages/BookDetailPage.tsx
 M frontend/src/pages/ChapterReadingPage.tsx
 M frontend/src/pages/CreateBookPage.tsx
 M frontend/src/pages/CreateChapterPage.tsx
 M frontend/src/pages/EditBookPage.tsx
 M frontend/src/pages/EditChapterPage.tsx
 M frontend/src/pages/Forgot/email.tsx
 M frontend/src/pages/Forgot/password.tsx
 M frontend/src/pages/HomePage/ComicCard.tsx
 M frontend/src/pages/HomePage/ComicGrid.tsx
 M frontend/src/pages/HomePage/FeaturedSlider.tsx
 M frontend/src/pages/HomePage/Footer.tsx
 M frontend/src/pages/HomePage/Header.tsx
 M frontend/src/pages/HomePage/HomePage.tsx
 M frontend/src/pages/HomePage/SideDecorations.tsx
 M frontend/src/pages/HomePage/Sidebar.tsx
 M frontend/src/pages/HomePage/TopTrending.tsx
 M frontend/src/pages/SignUp/OTP.tsx
 M frontend/src/pages/SignUp/SignUpPage.tsx
 M frontend/src/store/useAuthStore.ts
 M frontend/src/store/useBookStore.ts
 M frontend/src/type/book.ts
?? PUBLISHING_REPORT.md
?? backend/scripts/
?? backend/src/migrations/20261104_0001_publishing.sql
?? backend/src/services/publishing.service.ts
?? backend/tests/
?? backend/vitest.config.ts
?? frontend/e2e/
?? frontend/playwright.config.ts
?? frontend/src/features/
?? frontend/src/test/
?? frontend/vitest.config.ts
```

```text
git diff --stat
backend/.env.example                            |    3 +
 backend/package-lock.json                       | 3185 ++++++++++++----------
 backend/package.json                            |   11 +-
 backend/src/auth/checkAuth.ts                   |    1 +
 backend/src/models/repositories/chapter.repo.ts |    4 +-
 backend/src/routes/upload/index.ts              |   14 +-
 backend/src/services/book.service.ts            |  174 +-
 frontend/.gitignore                             |    2 +
 frontend/package-lock.json                      | 3258 ++++++++++++++++++++---
 frontend/package.json                           |   17 +-
 frontend/src/App.tsx                            |    6 +-
 frontend/src/lib/axios.ts                       |   13 +-
 frontend/src/main.tsx                           |    7 +-
 frontend/src/pages/AuthorDashboardPage.tsx      |   13 +-
 frontend/src/pages/AuthorProfilePage.tsx        |    4 +-
 frontend/src/pages/BookDetailPage.tsx           |    6 +-
 frontend/src/pages/ChapterReadingPage.tsx       |   11 +-
 frontend/src/pages/CreateBookPage.tsx           |  285 +-
 frontend/src/pages/CreateChapterPage.tsx        |  181 +-
 frontend/src/pages/EditBookPage.tsx             |  246 +-
 frontend/src/pages/EditChapterPage.tsx          |  178 +-
 frontend/src/pages/Forgot/email.tsx             |    4 +-
 frontend/src/pages/Forgot/password.tsx          |    4 +-
 frontend/src/pages/HomePage/ComicCard.tsx       |    3 +-
 frontend/src/pages/HomePage/ComicGrid.tsx       |    6 +-
 frontend/src/pages/HomePage/FeaturedSlider.tsx  |   12 +-
 frontend/src/pages/HomePage/Footer.tsx          |    1 -
 frontend/src/pages/HomePage/Header.tsx          |    2 +-
 frontend/src/pages/HomePage/HomePage.tsx        |    6 +-
 frontend/src/pages/HomePage/SideDecorations.tsx |    1 -
 frontend/src/pages/HomePage/Sidebar.tsx         |    6 +-
 frontend/src/pages/HomePage/TopTrending.tsx     |   12 +-
 frontend/src/pages/SignUp/OTP.tsx               |    2 +-
 frontend/src/pages/SignUp/SignUpPage.tsx        |    2 +-
 frontend/src/store/useAuthStore.ts              |   61 +-
 frontend/src/store/useBookStore.ts              |   57 +-
 frontend/src/type/book.ts                       |    7 +-
 37 files changed, 4827 insertions(+), 2978 deletions(-)
```

`git diff --stat` excludes untracked new files; those are listed in the file table and status above. All Git invocations used the command-scoped safe.directory override described at the start.
