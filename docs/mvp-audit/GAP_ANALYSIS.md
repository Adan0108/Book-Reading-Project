# Gap analysis

See [feature matrix](FEATURE_MATRIX.md) for module-level evidence and [security findings](SECURITY_FINDINGS.md) for severity and reproduction details.

## Top ten missing or broken features

| Rank | Gap | Concrete evidence | Effect |
|---|---|---|---|
| 1 | Secure account completion and session invalidation | `SETUP_WITHOUT_PROOF`, `RESET_SESSION_REVOCATION`, `CONCURRENT_REFRESH`; `access.service.ts`, `checkAuth.ts` | Pending account setup can be claimed without caller proof; compromised sessions survive reset; refresh tokens can be replayed concurrently. |
| 2 | Author approval-to-publishing integration | `AUTHOR_APPROVAL`; `application.service.ts:approve` grants a role but no authors row | Approved user still receives publishing 403. Seeded-author demos conceal this. |
| 3 | Text-first author and reader experience | `PublicationEditor.tsx`, `ChapterReadingPage.tsx`; `TEXT_E2E` CSS metrics | Working Markdown is subordinate to image pages; novel formatting and reading rhythm are inadequate. |
| 4 | Real home browsing and discovery | `HomePage/ComicGrid.tsx` calls `generateComics()`, `TopTrending.tsx` generated data, `ComicCard.tsx` title uses `href="#"` | Main catalog does not reliably lead readers to persisted books despite a functioning search API. |
| 5 | Author tier/membership management | Membership schema/repository exists, no corresponding route/UI | Cannot configure 1–2 tiers, assign chapter eligibility, subscribe, renew or cancel through the product. |
| 6 | Sandbox checkout and verified entitlement activation | No provider SDK, checkout/webhook route, payment/event table | Paid-reader journey stops before purchase. A provider enum is not payment integration. |
| 7 | Sandbox donations and transaction history | No donation model/service/UI | Donation journey entirely absent. |
| 8 | Membership-protected persisted chat | No Socket.IO/WebSocket server, conversation schema or chat route | Promised member-author chat cannot be demonstrated. |
| 9 | Admin moderation and dashboard | Only `/admin/author-applications` exists; no admin frontend routes | Admin cannot find/hide/unhide books, review reported content or view platform totals. |
| 10 | Enforced visibility contract and reproducible release | `BOOK_VISIBILITY` guest 200; no complete app deployment/health setup; auth-only Swagger | Book-level locks are misleading, and local publishing test success is insufficient deployment evidence. |

## P0 — release blockers

1. Fix caller-bound setup proof, reset/block revocation and atomic refresh/session lifecycle. Preserve the tested chapter ownership boundaries. Treat the explicit asymmetric JWT requirement separately from naming keys “public/private”.
2. Atomically provision the author profile and role when approving an application; expose application and review UIs.
3. Make text the primary chapter surface and add usable writing/reading formatting. Keep text-only publication and all legacy Markdown compatible. Add optional verified inline illustrations rather than requiring hosted URLs.
4. Replace sample home catalog data with real published books and working reader links. Complete a reader’s discover → detail → chapter journey.
5. Define book-versus-chapter visibility inheritance and enforce it on the server; expose author tier settings and explicit eligible-tier selection.
6. Complete sandbox membership checkout → signed webhook → durable/idempotent payment record → author-scoped entitlement → access. Never activate from client redirects.
7. Complete sandbox donation processing and persisted history/totals, as required by this task’s MVP.
8. Implement member-author chat with authenticated connections, persisted history, expiry checks and cross-user isolation, as required by scope.
9. Add admin content moderation with hide/unhide audit events, immediate catalog/content enforcement and cache invalidation.
10. Establish reproducible local setup and a release path with readiness checks and critical full-journey tests. Production/normal-database deployment remains UNVERIFIED.

## P1 — usability, reliability and maintenance

- Deliberate text byte limits and friendly pre-save errors (`LONG_TEXT_LIMIT` returns 413 after a large chapter has already been written).
- Live preview, word count, autosave/durable local recovery and accessible editing; longer chapters should not depend on an eight-row optional textarea.
- Reading history, bookmarks and follows after core reading/paid access work. Current Follow control has no handler.
- Actual filter/pagination UI, finite integer request validation, genre/tag/status/sort semantics and indexes guided by observed query plans. MySQL LIKE is sufficient for the initial scope; no new search service is required.
- Chapter neighbor navigation using actual available chapter identifiers, not published-count arithmetic.
- TOC authenticated lock hints, dates/flag contract alignment and actionable access-denied membership prompts.
- Chapter archive/delete lifecycle, scheduled publishing orchestration and timezone tests. Storing `scheduled_at` is not a scheduler.
- Public author biography/profile editing and correct empty-author pages; author name should not depend on the first book.
- Complete OpenAPI for implemented routes and document errors/auth; add absent modules only when implemented, not as placeholders presented as working APIs.
- Retention policies for expired upload intents, orphan assets and idempotency rows. Deletion needs reference reconciliation and separate authorization; audit performed none.
- Remove noisy request/profile logging; harden SMTP TLS configuration and resolve dependency advisories.
- Redis outage behavior, cache/readiness gates, bounded analytics-key retention and durable view aggregation. Do not use Redis alone for financial events.
- Split the large frontend bundle and improve mobile touch/editor regression coverage once the core text UX is fixed.

## P2 — postpone

Recommendations, AI moderation, advanced revenue analytics, advanced tax/billing, complex notifications, multi-region infrastructure and exclusive post/social systems can wait unless explicitly sold as launch features. Kafka, Kubernetes, microservices, NestJS migration and external search engines are not dependencies of the missing MVP journeys.

## Architecture and duplication

The project has one frontend application and one Express API; keep them. `publishing.service.ts` centralizes transactional writes, but legacy `book.repo.ts` / `chapter.repo.ts` write helpers still coexist with those SQL paths. Avoid adding a third lifecycle. Prefer tested service boundaries before gradually removing unreachable helpers.

Legacy fan-art upload/deletion and new confirmed direct-upload flows coexist. The former buffers images in backend memory and lacks the new authorization quota. Keep semantics explicit and secure or deprecate that endpoint through a compatibility plan; do not delete old resources or merge fan-art into primary novel text.

New `chapter_images` can order pictures but cannot place an illustration between two paragraphs. An extension should store typed text/media positions or structured blocks referencing confirmed assets, while retaining a readable legacy `content_md` path. Do not generate Markdown image links solely to satisfy old storage, and do not perform destructive conversion during an audit.

Migration execution tracks filenames but has no checksum, cross-process lock or true transactional DDL guarantee. `runMigrationsOnce()` wraps SQL in a transaction even though schema DDL can commit independently. App startup catches failures and still exposes the server. Review deployment/migration orchestration before multiple API instances or production rollouts.
