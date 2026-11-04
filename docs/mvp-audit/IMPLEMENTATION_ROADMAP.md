# Implementation roadmap to MVP

This is proposed work, not implementation performed during this audit. Keep Express, React, MySQL, Redis, Cloudinary and legacy Markdown. Deliver complete user journeys rather than disconnected endpoint sets. P0 below reflects the explicit paid-reading, donation, chat and moderation scope.

## Task register

| ID | Feature | Current state | Required work | Dependencies | Priority | Acceptance criteria |
|---|---|---|---|---|---|---|
| R01 | Verification-bound signup completion | Public setup accepts email + global state | Issue expiring single-use setup authorization after OTP; bind completion to caller; transactionally activate/profile/role | Existing OTP tables/service | P0 | A different caller knowing email cannot claim a pending account; replay and concurrent completion denied; real test-inbox flow passes. |
| R02 | Session safety | Reset cutoff unused; concurrent RT reuse succeeds; blocked user retains access | Enforce reset/block cutoff or session version in all auth paths; atomically consume RT; session family/reuse detection; complete logout revocation lifetime | R01; Redis/DB session model | P0 | Old AT/RT denied after reset/block/logout; simultaneous refresh has at most one winner; seven-day RT cannot outlive revocation. |
| R03 | Asymmetric signing and auth hardening | HS256 despite public/private naming; broad rate limits absent | Meet specified asymmetric algorithm requirement with explicit allowlist/key handling; server password policy; login/IP throttles; cookie-only RT serialization | R02 | P0 | Tokens report approved asymmetric algorithm; wrong algorithm rejected; no RT in JSON; brute-force limits and cookie/security tests pass. |
| R04 | Author onboarding | Approval grants role, no authors row; no UI | Atomically approve + create/update author profile + role; applicant/reviewer UI; idempotent transitions | R01–R02 | P0 | Reader submits → admin approves → same account creates book without SQL seeding; reject/withdraw and unauthorized actions tested. |
| R05 | Primary novel writing and reader typography | Text persists, UI image-first, reader reset styles | Main text editor with formatting/preview; optional media; deliberate byte limit; heading/dialogue/paragraph styles and accessible reading layout | Existing publishing service | P0 | Long text-only draft/edit/publish/read works with zero uploads; authors can format without manual HTML; heading and paragraph rhythm visibly differ; mobile keyboard/reader tests pass. |
| R06 | Inline illustrations | Ordered images precede all Markdown | Model mixed positions/blocks referencing confirmed assets; local previews/deferred uploads integrated at insertion point; keep legacy Markdown | R05, existing intents | P1 | Illustration between chosen paragraphs survives reorder/save/reopen; no blob URLs persisted; old chapters unchanged. |
| R07 | Real browsing and chapter navigation | Home fake data, some `#` links; header search real | Persisted published catalog, loading/errors, working detail links; actual adjacent readable chapter IDs | R05, public book API | P0 | Newly published book is discoverable from home and search; hidden/draft books absent; sparse chapter numbering navigates correctly. |
| R08 | Tier authoring and management | Tables/read gates only | 1–2 author-owned tiers, prices/benefits, active state, explicit chapter tier mappings; reader membership screen | R02, R04 | P0 | Authors cannot change foreign tiers; readers see independent author memberships; invalid prices/mappings rejected transactionally. |
| R09 | Content entitlement policy | Chapter checks work; book restriction ignored; TOC auth absent | Define and enforce inheritance; share policy across detail/TOC/content; authenticate lock hints; inactive/future entitlement rules | R08 | P0 | Author A subscription never unlocks B; guests/expired/cancelled/wrong-tier denied after cache warming; UI lock matches backend result. |
| R10 | Membership sandbox payments | No implementation | Choose one provider, sandbox checkout, signed webhook, durable payment/event/idempotency ledger, author-scoped grants, renewal/cancellation | R08–R09 | P0 | Verified webhook activates once; redirect alone grants nothing; duplicate/out-of-order/invalid events safe; renewal/expiry end-to-end tests pass. |
| R11 | Sandbox donations | No implementation | Author-specific one-off checkout using same verified event infrastructure; donation history/totals | R10 event infrastructure | P0 | Sandbox payment creates exactly one attributed donation; failure creates no paid record; user/author totals and access isolation verified. |
| R12 | Member-author chat | No implementation | Authenticated real-time connection, conversations/messages, REST history/pagination, membership expiry enforcement | R09–R10 | P0 | Eligible member sends/receives durable messages; nonmember/foreign user denied; expiry revokes subsequent sends/joins/history according to policy. |
| R13 | Admin moderation and metrics | Applications API only | Admin UI and guarded user/book lookup; hide/unhide with durable audit records; basic totals, counts and reason | R02, R07, R09 | P0 | Admin hides/unhides warmed content and public access changes immediately; nonadmin denied; action reason/audit recorded; totals match SQL. |
| R14 | Profiles/history/search quality | Public author page derived from books; controls absent/inert | Author bio/profile editing, reader history/bookmarks/follows, finite pagination and filter contracts | R07 | P1 | Empty author profile works; real actions persist; invalid page returns 400; filters and URLs survive reload. |
| R15 | Scheduling/archive | Date columns, no scheduler/UI; soft-delete fields only | Date UI + timezone-aware release transition; archive/delete contracts; safe media retention | R05, R09 | P1 | Draft releases at intended UTC instant, never early; retries safe; archive removes reader access without cloud deletion races. |
| R16 | Release operations and regression gate | Builds/Compose pass; incomplete app setup/docs/readiness | Complete env template/setup, app images or documented hosts, health/readiness, migration locking/checksums, TLS/CORS, backup/restore, test gate | R01–R13 for full release | P0 | New developer boots from docs; readiness waits for DB/Redis; migration failure does not serve a ready API; all six journeys pass against isolated services and sandbox payments. |

## Phase 0 — secure identities and make authors real

Scope: R01–R04. Backend: bind OTP success to a short-lived single-use completion token, fix actual cutoff enforcement, atomic refresh and revocation duration, algorithm policy and author provisioning transactions. Frontend: signup/session recovery and applicant/admin review surfaces. Database: session/setup authorization state and unique author provisioning; use additive migrations. Redis: bounded login/OTP limits and atomic operations; maintain fail-closed protected routes.

Security: no email-only account claim; no session survives a successful reset/block; no double refresh winner. Avoid mixing long-lived RT handling into client-readable payloads. Regression tests must cover race conditions with separate clients/tabs, not only Axios's single-flight behavior.

Definition of done: full register → test inbox OTP → password setup → login/logout/reset passes, hostile setup/reset/replay tests fail safely, and approval leads to author creation without manual SQL. Do not proceed to selling access while these defects remain.

## Phase 1 — text-first free reading, discovery and basic moderation

Scope: R05, R07 and core R13. Frontend: default full writing surface, accessible formatting controls and preview, prose reader styles, live catalog/search/detail, actual chapter neighbors, admin lookup/hide/unhide. Backend: explicit text size validation and visibility-aware catalog/cache contracts. Database: moderation audit records; keep text stored compatibly in `content_md` and avoid destructive conversion.

Security: keep Markdown HTML disabled; use confirmed assets for media; ownership and admin authorization remain server-side. Admin hide must invalidate book and chapter data and must not rely only on Redis expiry.

Tests: text-only chapters with dialogues, headings, Unicode and long paragraphs; exact draft/edit preservation; draft gaps; invalid-size errors preserving unsaved work; hide/unhide with warm caches; reader/admin role rejection; mobile layout and keyboard editing.

Definition of done: journeys A, B and F work for newly registered/approved users, not only fixtures. This is a credible **limited free-reading milestone**, not the full paid MVP. R06 can follow once the primary writing model is settled.

## Phase 2 — author-scoped tiers and entitlement policy

Scope: R08–R09. Backend: author-owned tier CRUD and validated chapter mappings, active/current period rules, shared gate for book/TOC/content, reader membership retrieval. Frontend: 1–2 tier author editor, chapter eligibility selection, membership management display and actionable lock prompt. Database: strengthen uniqueness/constraints and entitlement/event provenance as needed; retain existing author/tier composite foreign keys.

Security: no client-selected role or tier upgrade, no cross-author tier writes, no chapter leak through cache or public book-level override. Define cancellation grace and future-start behavior explicitly; do not infer a numeric tier hierarchy from arbitrary IDs.

Tests: existing audit matrix plus foreign tier mutation, disabled tier, future start, allowed mapping, cancellation, book inheritance and authenticated TOC hints. Definition of done: a manually seeded entitlement can exercise all access boundaries through UI; label it as a test grant until verified payments exist.

## Phase 3 — verified sandbox payments and donations

Scope: R10–R11. Use a single provider initially. Backend: server-defined checkout line items/author/tier, raw-body signature verification, durable transaction/event ledger, unique provider event IDs, idempotent handlers and entitlement state machine. Persist grants and money records transactionally; reconcile external effects separately. Frontend: author tier checkout, pending/success/failure UI, independent memberships, donation form/history and totals. Database: additive payment, webhook-event, entitlement provenance and donation records; Redis must not be the sole financial source of truth.

Security: redirect/query parameters never activate access; repeated webhooks cannot double-charge/duplicate grants; verify customer/user/author/tier association and amount/currency. Keep provider secrets backend-only. No real money is needed for acceptance.

Tests: valid/invalid signatures, duplicate/out-of-order event delivery, timeout/retry, failed payment, renewal/cancellation/expiry, reader A versus B, donation attribution and financial totals. Definition of done: journeys C and D pass in sandbox from browser checkout to verified event to durable outcome.

## Phase 4 — member-author messaging

Scope: R12. Backend: one real-time transport (Socket.IO is sufficient), authentication and shared membership policy, conversation ownership, message persistence and cursor pagination. Frontend: eligible chat entry, history, send/receive/error/reconnect states. Database: conversations, participants and ordered messages with proper indexes/foreign keys.

Security: authenticate each connection, authorize every join/send/history access, recheck expiry or invalidate membership sessions promptly. Do not treat room names supplied by clients as authorization. A Redis adapter is optional until multiple instances are needed.

Tests: two-client delivery, reconnect/history, duplicate sends, pagination, nonmember and foreign-user denial, expired member after an established connection. Definition of done: journey E works durably; Kafka is not required.

## Phase 5 — release gate and selected P1 improvements

Scope: R16 and high-value R14–R15 work promised for launch. Backend/frontend: no surprise feature expansion; close API contracts and observability. Database: review migration locking/checksum, backup/restore and recovery from partially applied DDL. Operations: production TLS, secure cookies, SMTP certificate validation, secret provisioning, bounded resource limits, health/readiness and a documented deployment/migration process.

Tests: rerun all six journeys and security regression scenarios in disposable databases and sandbox services. Include Redis/DB startup failures, duplicate provider events and cached visibility changes. A clean build and green publishing tests alone do not satisfy this gate.

Definition of done: all thirteen conditions in [MVP_READINESS](MVP_READINESS.md) pass with evidence; no open high-impact auth/access/payment defect; normal-environment rollout has backup/recovery and explicit operational ownership. No numeric delivery estimate is supplied without team capacity and provider choices.
