# HiBook release readiness

5 November 2026, Australia/Sydney. **Core MVP implementation and local verification pass. Production rollout remains unverified and requires external configuration.** This is distinct from the preserved original audit, which accurately recorded the former missing modules and auth defects.

| Decision | State | Evidence / boundary |
|---|---|---|
| Core implementation | VERIFIED | Reader, author, admin, memberships, billing adapter, donations, chat and local deployment exist |
| Automated verification | VERIFIED | 127 backend / 18 frontend tests, fourteen headed journeys and a separate built Compose journey; types/lint/builds pass |
| Cloudinary signed uploads | VERIFIED | Real retained direct uploads, server confirmation, no upload on selection, ordered persistence and replay |
| Stripe adapter and simulated payment lifecycle | VERIFIED | Real SDK signatures, raw HTTP webhook, MySQL ledger/grants/refunds and browser checkout fixture |
| External Stripe sandbox | UNVERIFIED | Credentials absent; follow [sandbox procedure](PAYMENT_SETUP.md) |
| SMTP | PARTIAL | Actual local SMTP sinks pass registration/reset; external provider/TLS delivery unverified |
| Local deployment | VERIFIED | Fresh MySQL 8.4 application stack, migration gate, health, outage recovery and retained-data recreation |
| Production rollout | UNVERIFIED | Normal database upgrade, real HTTPS/origin/proxy/cookies, secrets, backups and external services remain operator steps |

## Feature matrix

| Module | Implementation | Verification |
|---|---|---|
| Auth/session recovery | RS256 purposes, caller-bound setup, durable refresh families and reset/suspension revocation | MySQL/HTTP security regressions, real SMTP browser onboarding/reset, async client races |
| Author approval | Transactional profile and role provisioning | Reader-to-approved-author headed journey and backfill tests |
| Writing studio | Mature BlockNote engine, canonical v1 document, formatting, autosave, drafts and publication | Long-form zero-image journey, interrupted autosave, reopen/edit and legacy compatibility |
| Optional artwork | Signed local-first covers, chapter illustrations and post gallery | Real Cloudinary, preview/replacement/removal/order, confirmation/purpose/ownership checks |
| Reading | Structured and safe Markdown, typography/theme, real chapter navigation and progress | More than 100 KiB text, mobile width and actual rendered accessibility |
| Discovery/library/profiles | Real filters/search, public/private profile separation, follows, bookmarks, synchronized history | Real MySQL scope/collision/cursor tests and headed reader journey |
| Memberships | At most two managed author tiers, platform prices, exact legacy tiers, shared parent/child entitlement rules | Cross-author/tier/expiry tests and headed membership gates |
| Payments/donations | Sandbox adapter, server quotes, signed webhooks, journal, invoice periods, refunds, cancellation and histories | Deterministic SDK/provider fixtures and full HTTP/MySQL/browser lifecycle; external sandbox separate |
| Chat | Persisted 1:1 messages, retry IDs, participant history, cursors, unread/read positions and authenticated delivery | Real loopback Socket.IO, reconnect/lost acknowledgment, expiry/revocation and two-browser journey |
| Author posts | Public/exclusive updates, spoiler reveal, optional ordered artwork and idempotent saves | Database security/replay/order and headed lost-response/spoiler/member redaction |
| Administration | Approvals, suspension, independent moderation, reports, versioned policies, audit and actual metrics | Real database concurrency/visibility tests, delayed-preview race and headed admin journey |
| Operations/API | Awaited startup, locked/checksummed migrations, graceful draining, Redis boundaries, OpenAPI and app containers | Parser tests, real outage/startup rejection, fresh MySQL 8.4 deployment and persistence |
| UI/accessibility | Shared auth/navigation, typed states/retries, keyboard focus, dark contrast, reduced motion and lazy routes | 33 rendered axe states, actual screenshot inspection at desktop/tablet/mobile; no certification claim |

## Engineering and UI report

The [architecture index](../architecture/README.md) documents concrete service/repository responsibilities, the small provider adapter and shared entitlement rules. [UI decisions](../architecture/UI_DESIGN.md) explain the final design system, access hook, route loading and discovered/fixed defects. No framework migration, broker, microservice platform or artificial domain framework was introduced.

Author management now offers real search, stable pages, chapter controls and visible retry states. Authentication reuses a layout/field set rather than six unrelated templates. Reading retains a focused serif layout and adjustable preferences. Screenshot evidence is ignored under `frontend/test-results/` and `frontend/compose-results/`; exact paths and inspection limits are in [the test report](TEST_REPORT.md). The main bundle is approximately 409 kB / 133 kB gzip; the optional authoring engine remains approximately 998 kB / 308 kB gzip. These are artifact sizes, not a performance benchmark.

## Security and payment report

The audited setup bypass, usable sessions after reset, concurrent refresh replay and broken author provisioning were repaired and regression tested. New writes scope confirmed assets, content and tier references to their author. Shared access checks precede protected cached bodies and socket delivery. Moderation changes and account revocation are transactionally audited. Client generations and restoration barriers prevent stale responses or incomplete profile restoration from presenting a false restored session.

Stripe checkout amounts/currency/share are server snapshots, not browser authority. Only a fresh verified sandbox webhook can commit a payment/grant. Duplicate IDs/events, late events, invoice windows, partial/full refunds and cancellation have real-database tests. Donations do not create membership grants. The QA provider is explicitly labeled and absent from production images. Payouts, tax/fees, disputes and live-money operation are not implemented or claimed. See [payment design](../architecture/PAYMENTS.md) and [external sandbox checklist](PAYMENT_SETUP.md).

No known critical issue remains from the executed audit/regression scope; this is not a full penetration audit. Confirmed remaining limits include public Cloudinary delivery after a URL is obtained, database-resident private keys requiring protected storage/backups, single-backend socket delivery, non-durable local files/composers, and untested physical-touch/maximum-memory cases. Current dependency auditing records nine backend and twelve frontend moderate advisories, with zero high/critical advisories; nonzero audit exits are not reported as clean. See [security](../security/README.md).

## Reproduction and remaining actions

Use [testing](../testing/README.md) and [exact executed commands](TEST_REPORT.md). MySQL writes were limited to `publishing_qa` on localhost:3307 and the dedicated Compose project. The normal database was not repointed or migrated. Shared Redis was not flushed. Real test images and all fixture volumes are retained; no cloud deletion, real email or financial transaction occurred.

Before public release: configure and verify external Stripe sandbox and SMTP; deploy HTTPS with reviewed proxy/origin/cookie settings; protect secrets and private-key storage; back up and test the reviewed additive upgrade on a restored copy before the normal database; review remaining advisories and public-image delivery requirements. Live payments are intentionally outside the implemented sandbox mode.

Feature/merge hashes and remote confirmation are maintained in [implementation progress](IMPLEMENTATION_PROGRESS.md). Final merged-main verification at `fc6f022` passed: 127 backend tests, 18 frontend tests, all fourteen headed journeys (3.8 minutes), types/lint/builds and the built Compose journey (25.1 seconds). Application branches and main were confirmed on GitHub; all feature tips are ancestors of main. The final release-record commit changes documentation only. Local verification does not establish a production deployment.
