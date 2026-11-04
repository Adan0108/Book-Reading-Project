# MVP acceptance checklist

States: NOT STARTED, IN PROGRESS, BLOCKED, COMPLETED, VERIFIED, MERGED. Implementation status and external provider verification are deliberately separate. No completion percentage is assigned.

| Category | Status | Implementation / evidence | Related commits and remaining limits |
|---|---|---|---|
| Audit preservation | MERGED | Original `docs/mvp-audit/` and publishing report retained | `eed0a70`; historical findings are not current results |
| Auth and sessions | MERGED | `session.service.ts`, `access.service.ts`, auth middleware; real database/HTTP and headed OTP/reset/replay regressions | `bac8f04`, `5b2c349`; external HTTPS/SMTP separate |
| Author approval | MERGED | Transactional application decisions/profile/role, backfill and review UI | `bac8f04`; headed register-to-author journey passes |
| Text-first block editor | MERGED | `features/studio/`, canonical `novelDocument.ts`, document repository/migration | `d326c94`; 100+ KiB text, formatting, autosave, reopening, optional artwork tested |
| Book/chapter CRUD and draft/publish | MERGED | Transactional publishing, ordered assets and save journal | `91ac82a`, `d326c94`, `5b2c349`; legacy Markdown/IDs preserved |
| Comfortable reader | MERGED | Structured/safe Markdown rendering, typography/theme, real TOC and navigation | `d326c94`, `5b2c349`; desktop/mobile and accessibility checks pass |
| Optional Cloudinary images | MERGED | Signed intent/confirmation and bounded local-first upload service | `91ac82a`, `d326c94`, `cbca166`; real cloud tested, public delivery limitation documented |
| Membership tiers | MERGED | Author-owned managed levels, platform pricing/share, versioned admin policy and UI | `17a6350`; at most two managed tiers, legacy relationships preserved |
| Central server entitlements | MERGED | Shared author/book/chapter/post/chat policy and paid invoice window SQL | `17a6350`, `8921b5a`, `a36e970`; cross-author/tier/expiry/paid-period gaps tested |
| Payment adapter and sandbox lifecycle | MERGED | Stripe adapter, server quotes, raw signature verification, atomic ledger/grants/replay/refunds/cancellation | `8921b5a`; SDK/HTTP/MySQL and labeled fixture browser journey pass |
| Donations | MERGED | Server-validated amounts, split/refund records, reader/author histories | `8921b5a`; donations never grant membership; no live money/payout claim |
| Member chat | MERGED | Durable conversations/messages/read positions, REST and Socket.IO authorization | `a36e970`; two-browser reconnect/retry/unread/expiry tests; one backend instance |
| Administration/moderation | MERGED | Independent visibility flags, reports, suspension, settings, audit and actual statistics | `8392429`, `5b2c349`; concurrency, delayed preview and headed admin workflow pass |
| Search/discovery | MERGED | Actual catalog/filter facets, bounded validated stable pagination and real author profiles | `bef86b4`, `5b2c349`; guest and signed-in journeys pass |
| Account/author profiles and library | MERGED | Private/public biography separation, scoped updates, follows/bookmarks/history and analytics | `bef86b4`; collisions, privacy, tied cursors and progress entitlement tested |
| Posts, spoilers, optional artwork | MERGED | `post.service.ts`, ordered media, save replay, teaser redaction and native spoiler reveal | `cbca166`, `5b2c349`; older posts paginate, real artwork/lost-response journey passes |
| Redis and failure recovery | MERGED | Bounded fail-closed security commands, SQL cache fallback, dedup/noeviction policy | `3b8fe99`; actual isolated outage/recovery and 503 contracts tested |
| Migration safety/startup | MERGED | Awaited dependencies, checksums/advisory lock, explicit production migration and readiness/draining | `3b8fe99`; fresh/rerun/changed/missing migration and failed-start tests pass |
| OpenAPI | MERGED | All implemented modules, schemas, errors, roles/cookies/signature boundaries, JSON and Swagger UI | `3b8fe99`, `5b2c349`; existing parser validation and rendered Swagger pass |
| Complete local Docker deployment | MERGED | Backend/frontend/MySQL/Redis/mailbox, private persistent volumes and health/migration gate | `3b8fe99`; fresh MySQL 8.4 and retained-data rebuilt-stack journey pass |
| UI/UX and root README | MERGED | Shared auth/navigation/access hooks, real workspace/retries, focus/contrast/reduced motion, lazy routes | `5b2c349`; 33 axe states, inspected desktop/tablet/mobile; full certification not claimed |
| Final cross-module regression | VERIFIED | `main` at `fc6f022`: 127 B / 18 F / fourteen headed journeys + one built Compose journey | Types/lint/builds pass; [exact report](TEST_REPORT.md) |
| Audited critical security defects | VERIFIED | Setup proof, reset revocation, refresh replay, author provisioning and scoped authorization regressions pass | No known critical issue in executed scope; not a complete penetration audit |
| External Stripe sandbox | BLOCKED | Integration code and deterministic lifecycle pass | Missing credentials; [external setup/verification](PAYMENT_SETUP.md) |
| External SMTP/TLS | BLOCKED | Actual local SMTP/mailbox pass | External delivery and certificate verification remain operator checks; no real-user mail sent |
| Public deployment and normal database | BLOCKED | Local deployment verified; reviewed migration/backup procedure documented | HTTPS/proxy/secrets/backups and normal database rollout not performed |

Current dependency audit: nine backend and twelve frontend moderate advisories, zero high/critical. Other confirmed limits are public Cloudinary delivery, private-key storage operations, retained orphan assets/journals, single-instance socket delivery, in-memory unsaved files/composer and incomplete physical-device/maximum-memory coverage. See [release readiness](RELEASE_READINESS.md) and [security](../security/README.md).
