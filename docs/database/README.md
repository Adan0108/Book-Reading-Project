# Database and migration operations

MySQL is authoritative for book/chapter content, canonical documents, ordered assets, session families, memberships, billing events/payments/refund adjustments, private chat, library state and moderation audits. Redis expiration cannot create or remove a paid invoice window. Database foreign keys, uniqueness, author/user locks and service validation enforce ownership, order and idempotency together.

SQL lives in `backend/src/migrations/` and is copied into the build. `npm run migrate` executes the built runner. It acquires a database-scoped advisory lock, checks all applied filenames and normalized SHA-256 checksums, and records each new file only after its statements finish. A missing/edited applied file stops startup. Windows CRLF and Unix LF hash identically. Historical journal rows without checksums are adopted only by an explicit migration run; this records the reviewed current file, not proof of its earlier contents.

MySQL DDL commits implicitly. A failing file may have partially changed the schema even though it is not journaled. **Do not assume rollback and rerun blindly.** Inspect the failed statement and actual schema, preserve a backup, and prepare a reviewed forward repair. Never edit an applied migration to silence a checksum error. Production startup verifies the schema by default; it does not apply pending files unless explicitly configured.

## Existing database rollout

1. Back up and test restoration of the existing schema/data. Verify the target connection without printing credentials.
2. Review all pending SQL and the previous application version. Test the same upgrade on an isolated restored copy.
3. Build the backend, then run `npm run migrate` against the intended database using a migration operator account.
4. Start the application with `MIGRATIONS_AUTO_APPLY=false`, inspect readiness, and verify login, legacy Markdown, draft/published chapters and access rules.
5. Keep additive tables during an application rollback. Rolling back to the old auth implementation would reintroduce audited defects.

The author publishing additions preserve legacy IDs, URLs, Markdown and chapter-linked fan art. Structured chapter documents are separate from legacy Markdown; opening an older chapter does not silently convert it. Library/public biography and post artwork migrations add relationships rather than repurposing private profile data or fan-art records. Deployment to the owner's normal database has not been performed.

## Fresh installation and operator access

The Compose migration service initializes an empty database after MySQL passes its authenticated health check. Default roles are seeded, but there is no default administrator password. Register and verify an account, then use the local operator CLI described in [deployment](../deployment/README.md). Protect migration credentials, private JWT-key rows and backups. Production runtime users should receive the least reviewed privileges, with DDL restricted to a separate migration identity.
