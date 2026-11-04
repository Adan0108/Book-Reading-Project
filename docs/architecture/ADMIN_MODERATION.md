# Administration and moderation

5 November 2026. The admin console uses the existing modular monolith and database-backed roles. It provides account/author lists, content review, report queues, reasoned visibility decisions, operational counts, pricing/settings, sandbox reconciliation and a read-only audit trail. No action issues a live charge, deletes content or changes credentials.

## Publication versus moderation

`moderation_flags` stores a BOOK, CHAPTER or POST target, hidden state, reason, version and responsible administrator. It is independent of an author's draft/publication fields. Republishing cannot remove an administrative flag. Restoring visibility cannot publish a draft, bypass membership rules or release scheduled content. The polymorphic target has no generic cross-table foreign key: the service validates and locks the whitelisted target table before updating its flag. Existing content is soft-deleted; no hard deletion workflow is added.

Public repository predicates centralize approved/active author availability, publication/release time and moderation visibility. Discovery, author-book lists, book detail, chapter counts/TOC, chapter bodies and post feed/direct reads apply them. Fresh availability checks precede protected body-cache retrieval; hiding a warmed book/chapter immediately blocks its reader route. Descriptive book-cache entries are invalidated after commit, while authorization remains independent of cache invalidation success.

Authors can still edit their own text. Their book/chapter responses include the moderation notice and reason, and the studio explains that saving does not restore public access. Post management shows the same distinction. Administrators have a separate protected preview route for hidden text, validated structured documents and confirmed chapter illustrations; public reader routes still return unavailable. Raw text is rendered as text; structured preview reuses the safe reader renderer.

## Accounts, reports and audit

Account suspension updates the state and revokes all durable sessions in one transaction. Restoring does not resurrect those sessions. Pending setup cannot be activated through moderation, and an administrator cannot suspend their own account. Administrative account changes acquire the same policy-row lock and recheck the initiating administrator within that transaction. A race in which two administrators suspend each other therefore permits only one action, retaining an active administrator. There is no role-grant or password-setting endpoint in this console.

Authenticated readers can report published, available content, including a paid chapter's visible title without access to its protected body. Reports contain a bounded plain-text reason. A user lock prevents duplicate open reports for the same target and enforces the rolling daily quota. The default is five new reports per account/day; admins may configure 1–20 or temporarily disable new reports. Reports do not automatically hide content. Review states OPEN → REVIEWING → RESOLVED/DISMISSED are version-checked, and closed reports cannot be reopened through this API.

Content decisions, account actions, report reviews and settings changes require a reason and append an audit row in the same transaction. Versions reject stale decisions instead of silently overwriting another administrator. Account lists return only operational profile/role/state fields, never password hashes, signing keys or tokens. Audit views are read-only.

## UI and metrics

The shared admin layout links the dashboard, users/authors, content, reports, settings, pricing, reconciliation, applications and audit trail. A small abortable resource hook scopes each result to its endpoint; changing filters cannot display old results under a new resource type. Preview responses also carry a selection generation so an older response cannot appear as the newly selected content. Table overflow is contained and keyboard focusable on mobile.

Dashboard counts come from MySQL: users, active approved authors, visible published books, released visible chapters, recorded book views, eligible membership records, open reports and sandbox donations after refunds. They do not represent unique readers, settled author payouts or live revenue. Redis-only chapter view increments are not presented as durable book views. No synthetic statistics are generated.

## Evidence and limits

Real database tests cover token/role denial, credential-field omission, warmed-cache hiding, author republish resistance, chapter counts/TOC, post filtering, draft restoration, report deduplication/quotas/versions, audit reasons, setup protection, suspension/revocation, competing admin actions and actual statistics. The headed journey reports, reviews, hides/restores, verifies author notices and reader visibility, suspends/restores an account, saves settings, checks audit and inspects mobile content management.

No automated content classifier, appeal workflow, hard deletion, private-chat browsing, bulk account action or financial mutation is introduced. Review of existing external public media URLs remains subject to the historical media-delivery caveat. New schema has been applied only to isolated QA data. See [test evidence](../mvp/TEST_REPORT.md).
