# Author memberships and access policy

5 November 2026. Branch: `feat/author-memberships`.

## Product rules

An author can configure two managed monthly tiers. The platform defines their USD base prices and platform share; authors choose names, descriptions, benefits and whether new subscriptions are available. Author requests containing a client-defined price/currency are rejected. Admin policy changes require the current version and write an audit record in the same transaction. Current prices apply to new checkout quotes; changing policy must not silently reprice an existing provider subscription.

Tier 2 includes tier 1 content from the same author. Membership never crosses author identity. Earlier tiers remain stored and accessible through existing exact tier relationships; their ordering is not guessed. An author can assign an earlier tier to an empty managed level. Only configured managed tiers are offered publicly for new subscriptions. Hiding a tier from sale does not revoke an already-paid period.

Access requires ACTIVE membership, a start at or before the database clock and an end strictly after it. PAST_DUE, EXPIRED and CANCELED do not grant access. Cancel-at-period-end keeps ACTIVE status with renewal disabled until expiry. Manual QA memberships support that cancellation directly. Provider-backed cancellation currently returns an honest unavailable response until the payment adapter phase is implemented; no payment or subscription is fabricated by the UI.

## Shared authorization

`entitlement.service.ts` owns `canReadChapter`, `canViewPost` and `canJoinAuthorChat`, plus conversion of decisions to consistent 401/403/404 errors. A context loads fresh author availability and all eligible memberships, preserving overlapping legacy grants. The author and an active administrator can access published restricted content without purchasing a membership. This does not expose drafts/future releases through public reader APIs. Private chat eligibility requires author identity or an active membership; administrator privileges alone do not grant participation.

Chapter access combines the book rule and the chapter rule. A PUBLIC child never overrides a restricted parent. Both sets of tier relationships are scoped to the author. Chapter headers use the same policy as content; tier rules are fetched in batches for the table of contents. Content authorization occurs before cache retrieval. Book availability is checked freshly before cached metadata is returned, so a hidden book or unavailable author does not survive through a warmed cache.

Publication persists tier relationships inside the existing content transaction. Foreign-author tiers are rejected. Unchanged legacy selections remain untouched by the editor; selecting a replacement is explicit. Scheduled release timestamps use database `FROM_UNIXTIME` rather than host-local Date serialization, so comparisons use the same clock as `NOW()`.

Post feeds return titles and locked status for ineligible readers, with no protected body or excerpt. Individual post reads enforce the same policy. Post storage is separate from chapters and supports draft/public/member/tier access. It introduces no new interpretation of the existing fan-art table.

Chat currently has a tested eligibility policy only. Conversations, messages and sockets are not implemented by this phase.

## Browser sessions

Public feeds can return 200 with guest previews. The Axios client therefore restores a saved session before optional-auth requests, using the existing non-rotating access-cookie bootstrap and shared refresh coordination. A genuine guest has no saved identifier and remains anonymous. A temporary session/profile service failure preserves that identifier for retry; only an actual authentication rejection clears it. Business routes still require the validated Bearer token.

## Persistence and external dependencies

`20261104_0005_memberships_posts.sql` adds the singleton pricing policy, explicit tier levels, author posts and admin audit log. Existing membership/tier rows and content are retained. This migration has been run only in the isolated QA schema. No production database or existing financial provider has been changed.

Stripe checkout, verified webhooks, durable payment/donation records and provider cancellation are the next phase. Public subscription controls remain unavailable until that integration exists. A working manual QA membership is evidence of authorization, not proof of a real payment.

Tests: [current report](../mvp/TEST_REPORT.md). Remaining baseline media-delivery and deployment caveats are still documented in [the security audit](../mvp-audit/SECURITY_FINDINGS.md).
