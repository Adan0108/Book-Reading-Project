# HiBook MVP implementation

**Core MVP: IMPLEMENTED AND LOCALLY VERIFIED. Production rollout: UNVERIFIED.** The final suite passes 127 backend tests, 18 frontend tests, fourteen headed journeys and one built Compose journey. External Stripe sandbox, external SMTP/TLS, HTTPS/proxy deployment and the normal database upgrade remain separate operational checks. See [release readiness](RELEASE_READINESS.md); the original audit is preserved as historical evidence.

| Record | Purpose |
|---|---|
| [Master checklist](MASTER_CHECKLIST.md) | Explicit acceptance states and evidence |
| [Implementation progress](IMPLEMENTATION_PROGRESS.md) | Phase/branch history and active work |
| [Security](../security/AUTH_SESSIONS.md) | Implemented session and setup boundaries, rollout trade-offs |
| [Test report](TEST_REPORT.md) | Current executed validation |
| [Publishing architecture and API](../publishing/PUBLISHING_REPORT.md) | Existing publishing contracts and additive schema |
| [Writing studio architecture](../architecture/WRITING_STUDIO.md) | Engine choice, structured documents, media, autosave and rollback |
| [Membership architecture](../architecture/MEMBERSHIPS.md) | Author tiers, platform pricing and shared access policy |
| [Billing architecture](../architecture/PAYMENTS.md) | Provider boundary, verified invoices, refunds, ledger and test limits |
| [Payment sandbox setup](PAYMENT_SETUP.md) | Required configuration and external verification procedure |
| [Member chat](../architecture/MEMBER_CHAT.md) | Privacy, expiry, persistence, socket delivery and recovery |
| [Administration](../architecture/ADMIN_MODERATION.md) | Independent moderation, account actions, reports, audit and metrics |
| [Author posts](../architecture/AUTHOR_POSTS.md) | Spoilers, optional artwork, save replay and locked response redaction |
| [Discovery and library](../architecture/READER_LIBRARY.md) | Real catalog, profile privacy, follows, bookmarks and reading history |
| [Current API changes](API_CONTRACTS.md) | Implemented authentication and structured-publishing additions |
| [Remaining roadmap](../mvp-audit/IMPLEMENTATION_ROADMAP.md) | Baseline dependencies for later phases |

All future feature claims and the final repository README must reflect merged, tested behavior. External service configuration and live verification are separate from implementation completion.
