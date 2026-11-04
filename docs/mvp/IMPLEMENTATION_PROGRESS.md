# HiBook MVP delivery record

Updated 5 November 2026, Australia/Sydney. **Core implementation is merged and locally verified.** The application revision verified on `main` is `fc6f022b3580cf5a2d477a8f4933726a409b6534`. Later release-record commits change documentation only. [Release readiness](RELEASE_READINESS.md) separates implementation, automated evidence, external integrations and public rollout.

## Phase history

Counts below are the observed checks at each milestone, not percentages or coverage claims. B/F = backend/frontend tests; E2E = headed Chromium journeys. Every listed application feature branch remains available and its tip was confirmed on `origin` with `git ls-remote`.

| Phase | Status | Branch | Commit | Tests at milestone | Merge |
|---|---|---|---|---|---|
| Original local-first publishing | MERGED | `Q-FE` | `91ac82a` | 25 B / 11 F / 2 E2E | `82b4bf9` |
| Preserve completed audit | MERGED | `main` documentation baseline | `eed0a70` | Historical audit retained; no app source change | Direct documentation commit |
| Authentication and author provisioning | MERGED | `fix/auth-session-security` | `bac8f04` | 38 B / 11 F / 3 E2E | `4e602cd` |
| Text-first studio and reader | MERGED | `feat/light-novel-editor` | `d326c94` | 47 B / 12 F / 6 E2E | `30fef17` |
| Author tiers and shared entitlement policy | MERGED | `feat/author-memberships` | `17a6350` | 63 B / 12 F / 7 E2E | `d55593e` |
| Sandbox billing and donations | MERGED | `feat/payment-donations` | `8921b5a` | 78 B / 12 F / 8 E2E | `1359447` |
| Member-author chat | MERGED | `feat/member-chat` | `a36e970` | 87 B / 12 F / 9 E2E | `2e64620` |
| Administration and moderation | MERGED | `feat/admin-moderation` | `8392429` | 97 B / 12 F / 10 E2E | `abaac79` |
| Discovery, profiles and private library | MERGED | `feat/reader-discovery` | `bef86b4` | 109 B / 15 F / 12 E2E | `4d9472c` |
| Post spoilers and optional artwork | MERGED | `feat/author-posts-media` | `cbca166` | 116 B / 15 F / 13 E2E | `9755dcd` |
| Startup, migration safety, Redis, OpenAPI and Docker | MERGED | `feat/platform-operations` | `3b8fe99` | 125 B / 15 unchanged F / 13 E2E + 1 Compose | `74ba157` |
| Cohesive accessible UI, final integration and root README | MERGED | `refactor/ui-design-system` | `5b2c349` | 127 B / 18 F / 14 E2E + 1 Compose; 33 rendered accessibility states | `fc6f022` |

No merge conflict, force-push, reset or branch deletion occurred. Each implementation merge's application tree was checked against its tested feature tree. The unrelated original branch remains untouched. The final `docs/mvp-release` record contains no application-source changes; its commit/merge identifiers are supplied by the final Git commands and delivery report rather than a self-referential hash inside its own contents.

## Final merged-main verification

Executed on `main` at `fc6f022`, after all implementation phases merged:

- Backend types, **127 tests in sixteen files** (35.12 seconds), and production build passed.
- Frontend types, lint, **18 tests in five files** (6.24 seconds), and production build passed.
- Complete **fourteen headed journeys passed in 3.8 minutes**, including the actual rendered accessibility states, security/authorization/error paths, real cloud upload, long-form zero-image publication, payment fixtures, chat and moderation.
- The separately built complete Compose journey passed in **25.1 seconds**; registration/local SMTP, operator provisioning, publication, outage/recovery and retained data were verified.
- All application branch tips are ancestors of `main`; remote branch hashes matched. The main working tree was clean before this documentation record. [Exact commands and limits](TEST_REPORT.md) remain the authoritative execution log.

## Environment and remaining actions

Verification writes used only the existing isolated `publishing_qa` MySQL on localhost:3307 and the separate `hibook-mvp-verification-20261105` Compose project. Normal database settings were not repointed and its migrations were not run. Shared Redis was never flushed/stopped. Cloudinary test assets, fixture data and the signed preset are retained; no cloud deletion, real financial transaction or real-user email was performed.

The built local application is available at `http://localhost:8087`, with a development mailbox at `http://localhost:8027`, while that dedicated Compose project is running. Its random database passwords are in ignored `.env.compose.qa`. It has no external Stripe/Cloudinary configuration by default; unavailable integrations are reported honestly. Use the [deployment/testing guides](../deployment/README.md) for controlled startup/shutdown; do not delete retained volumes.

External Stripe sandbox verification, external SMTP/TLS delivery, public HTTPS/proxy/cookie verification and a reviewed backed-up normal database rollout remain operator steps. Known limits include public image delivery after URL disclosure, moderate dependency advisories, database-resident signing keys requiring protected storage, a single chat backend, and no durable offline files/composer or exhaustive physical-device/memory stress testing. See [release readiness](RELEASE_READINESS.md).
