# Discovery, profiles and private library

The home catalog uses real published books, explicit genre/tag filters and whitelisted recent/popular/updated ordering. Page size is bounded at 50; every ordering ends with an ID tie breaker. Search is bounded to 100 characters. Facets exclude drafts, hidden books and unavailable authors. There are no fabricated popularity cards, comments or ratings in the active discovery screens.

Public author profiles use approved author records, including authors with no books. Public biographies have their own table; an account's private biography and email never become public author data. Profile updates lock the caller's existing record and update only explicitly supported fields. A username collision returns 409 rather than using an upsert that could overwrite another account. Omitted fields retain their current values.

Bookmarks, follows and history are caller-owned. PUT operations express desired state and remain safe to repeat. History verifies current publication and parent/chapter entitlements before recording integer progress; it never fetches protected bodies, increments views or grants access. A 1.5-second browser debounce limits writes. Local reading positions remain a bounded fallback; cross-device progress requires authentication and a successful API write.

Library lists use 50-row cursors. History uses microsecond database time plus ID to retain equal-time entries and order revisits correctly. Cursor parsing validates calendar dates without applying a JavaScript timezone conversion. Hidden or unavailable records retain only enough identity to remove the caller's library entry; their former titles, covers and links are redacted. Account IDs supplied in bodies do not select another user's library.

Author statistics query actual owned books, published chapters, views, followers and currently eligible memberships. They are operational counts, not a claim of unique human readership or audited financial reporting.

## Browser state and verification

An abortable resource hook scopes results to their endpoint and is shared with administration. Account and author guards subscribe to identity changes, so logging out immediately removes private content. Client session generations reject late profile/refresh responses from an older login or logout. Bootstrap profile verification skips recursive refresh to avoid waiting on its own in-flight restoration promise.

Regression evidence includes real MySQL privacy, collision, pagination, entitlement and analytics checks; three reproduced asynchronous session races; and headed discovery/profile/library/reading journeys. The new discovery journey performs no Cloudinary requests. See [executed checks](../mvp/TEST_REPORT.md).

Migration `20261105_0010_reader_library.sql` is additive. It does not transform existing books, chapters, memberships or private account biographies. Apply it to an existing deployment only after backup and review. Facets are capped at 100 distinct genres/tags; full-text indexing and infinite facet search are not implemented.
