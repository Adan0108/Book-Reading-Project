# Implemented API changes

Base path: `/v1/api`. Existing success envelope: `{message,status,metadata}`. This index covers implemented changes; it is not a claim that later MVP endpoints exist.

## Authentication

See [session design](../security/AUTH_SESSIONS.md) and runtime `/api-docs`.

- `POST /access/verify-email` returns `metadata.setupToken`, a single-use ten-minute setup proof.
- `POST /access/setup-password` requires `{email,username,password,setupToken}`.
- Login/refresh return access tokens only. The refresh token stays in its HttpOnly cookie.
- `POST /access/session` requires the HttpOnly access cookie and `x-client-id`; returns the same verified access token without renewal.
- `POST /access/logout-all` requires access Bearer authentication and revokes all user sessions.
- Auth requests reject an untrusted Origin; successful/error responses are not cacheable. Rate limits can return 429.
- `GET /user/me` includes current roles for navigation. Backend guards remain authoritative.

## Structured publishing

The existing [publishing contracts](../publishing/PUBLISHING_REPORT.md) remain, with optional `contentDocument` added to chapter create/update and reader/author responses.

```json
{
  "version": 1,
  "blocks": [{
    "id": "stable-block-id",
    "type": "paragraph",
    "props": {"textAlignment": "left"},
    "content": [{"type": "text", "text": "A story begins.", "styles": {"bold": true}}],
    "children": []
  }]
}
```

Supported blocks: paragraph, heading (levels 1–3), quote, divider, authorNote and illustration. Illustration props contain only a confirmed `assetId` and optional caption. Link inline content contains a safe `href` and text children. Canonical validation projects out unsupported properties; raw HTML and local preview URLs are not persisted.

The server derives `imageAssetIds` in document traversal order. If the caller also supplies that field it must match exactly. Existing attachment ownership/purpose/book constraints still apply. Structured word count is server-derived. Limits: 512 KiB document JSON, 2,000 blocks, eight nesting levels, 100 images, 1 MiB total JSON request body. Validation returns 400; idempotency conflicts and legacy text updates to an already structured chapter return 409.

Chapter responses return `contentDocument: null` for legacy chapters and retain `contentMarkdown` and `images`. Consumers render the structured document when present; otherwise they use legacy Markdown and ordered pages. No automatic conversion occurs. See [architecture and rollback trade-offs](../architecture/WRITING_STUDIO.md).

## Author memberships and posts

Authenticated author routes: `GET /authors/me/tiers`, `PUT /authors/me/tiers/:level` (1 or 2), `GET /authors/me/members?cursor=`, and `GET`/`POST /authors/me/posts`, `PATCH /authors/me/posts/:postId`.

Tier writes accept `{name,description,benefits,available,existingTierId?}`. Pricing/currency is server-controlled. Public `GET /authors/:authorId/tiers` returns only managed tiers offered for sale, with integer `priceCents` and `pricingVersion`. These are offers, not proof of a payment or entitlement.

`GET /membership-policy` requires AUTHOR/ADMIN; `PUT /admin/membership-policy` requires ADMIN and `{version,currency,tierOneName,tierTwoName,tierOneCents,tierTwoCents,tierTwoEnabled,revenueShareBps}`. A stale version returns 409. Changes are transactionally audited.

`GET /memberships/me` returns the caller's membership status, author/tier, renewal state, period end and current `hasAccess`. `POST /memberships/:membershipId/cancel` disables renewal for a caller-owned manual membership without shortening its paid period. Provider-backed cancellation remains 503 until the billing phase.

Publishing accepts optional `requiredTierIds` on books/chapters. TIERS requires owned tier relationships. Omission preserves an existing selection. Parent-book and child-chapter restrictions both apply. Tier 2 includes tier 1 only for the same author; unmapped legacy tiers retain exact matching.

Post writes accept `{title,body,visibility,isDraft,minimumTierId?}`. Optional-auth `GET /authors/:authorId/posts?cursor=` returns published teasers with `isLocked`; protected bodies are omitted. `GET /authors/:authorId/posts/:postId` returns a body only after authorization. All `/v1/api` HTTP responses use `Cache-Control: no-store`; internal caches remain behind fresh access checks.

## Sandbox payments and donations

`GET /payments/configuration` exposes only provider name, configured boolean, sandbox/fixture mode and currency. Keys and signing secrets stay on the server. Missing configuration produces 503 for checkout/webhook/cancellation, with unavailable UI controls.

Authenticated `POST /payments/checkout` accepts `{requestId,kind:"MEMBERSHIP",authorId,tierId}` or `{requestId,kind:"DONATION",authorId,amountCents}` and returns `{id,url,mode}`. Prices, currency and share are server validated/snapshotted. Stable request IDs are required; conflicting/expired reuse and duplicate open author subscriptions return 409. New intents are limited to ten/minute and 100/day per user.

`POST /payments/stripe/webhook` consumes raw JSON and `Stripe-Signature` before JSON middleware. The signature must be fresh and sandbox-mode. Payment processing commits the event/payment/grant together. A browser redirect never grants access.

Authenticated `GET /payments/checkout/:checkoutId` is caller-owned and returns PENDING, PAID, PARTIALLY_REFUNDED, REFUNDED or EXPIRED. `GET /payments/me?cursor=` returns caller history/totals; `GET /authors/me/payments?cursor=` returns owned author income. Both paginate 50 records by decreasing ID.

`POST /payments/memberships/:membershipId/cancel` validates ownership and confirms provider cancel-at-period-end before updating renewal state; paid access remains subject to its invoice periods. The existing manual cancellation route remains available for manual memberships.

ADMIN-only `GET /admin/payments/reconciliation` provides ledger totals and up to 100 expired unconfirmed quotes for review. It neither issues charges/refunds nor changes entitlements. See [billing architecture](../architecture/PAYMENTS.md) and [external sandbox procedure](PAYMENT_SETUP.md).

## Author-member chat

All chat REST routes require access Bearer authentication and `x-client-id`.

- `POST /chat/conversations`: `{authorId,memberId?}`; readers may only create their own conversation; authors supply an eligible member ID. Returns the unique conversation ID.
- `GET /chat/conversations?cursor=`: participant-only summaries, eligibility and unread counts, 50-row ID cursor.
- `GET /chat/conversations/:id/messages?cursor=`: authorized chronological history page with `nextCursor`, `canSend` and `peerLastReadId`.
- `POST /chat/conversations/:id/messages`: `{clientId:<UUID v4>,text}`; persists once per sender/key and rejects conflicting reuse. Limit 4,000 characters, 30 new messages/minute and 1,000/day.
- `POST /chat/conversations/:id/read`: `{messageId}`; monotonic read position, message must belong to the conversation.

Socket.IO `/socket.io/` uses auth `{userId,token}` and trusted Origin. `chat:join` takes a conversation ID and acknowledges eligibility; `chat:leave` removes selection. Server events are `chat:message`, `chat:changed` and `chat:revoked`. Writes remain on REST to reuse refresh/idempotency/error handling. No arbitrary room join or cached protected packet replay is exposed. See [privacy, expiry and recovery policy](../architecture/MEMBER_CHAT.md).

## Administration and moderation

ADMIN-only routes: `GET /admin/dashboard`, `GET /admin/users?query=&role=AUTHOR&cursor=`, `PATCH /admin/users/:id/state` with `{active,expectedState,reason}`, `GET /admin/content?kind=BOOK|CHAPTER|POST&query=&cursor=`, `GET /admin/content/:kind/:id`, and `PATCH /admin/content/:kind/:id` with `{hidden,version,reason}`. Moderation state is independent of publication state. Self-suspension and activating pending setup are rejected; suspension revokes sessions transactionally.

Authenticated `POST /reports` accepts `{kind,resourceId,reason}` for available published content. It returns the existing open report on a repeated submission. Defaults: five new reports/account/day, maximum reason 2,000 characters.

ADMIN-only `GET /admin/reports?status=&cursor=` and `PATCH /admin/reports/:id` with `{status,version,reason}` manage review. Closed reports cannot be reopened. `GET`/`PUT /admin/moderation-policy` use `{reportsEnabled,reportsPerDay,version,reason}`; the allowed daily quota is 1–20. `GET /admin/audit?cursor=` is read-only. These lists use decreasing IDs and 50-row pages; stale versions return 409. All operational changes append audit reasons in the mutation transaction.

Author book/chapter and post-management responses add moderation notices. Reader routes return unavailable for hidden content before returning cached bodies. See [moderation design](../architecture/ADMIN_MODERATION.md).

## Discovery and private library

Public `GET /books` accepts `query`, `genre`, `tag`, `sort` (recent/popular/updated), `page` and `limit` (maximum 50). `GET /discovery/filters` returns visible genre/tag options. `GET /authors/:id/profile` supports optional authentication and returns explicit public author data, counts and caller follow state.

Authenticated routes: `GET`/`PATCH /user/me/profile`; `PUT /authors/:id/follow` with `{following}`; `PUT /library/bookmarks/:id` with `{bookmarked}`; `GET /library/books/:id`; `GET /library/bookmarks`, `/library/follows`, `/library/history` with optional cursor; `POST /library/history` with `{chapterId,progress}` (integer 0�100); and `DELETE /library/history/:id`. Identity always comes from verified authentication. Library pages contain at most 50 items and a nullable nextCursor. Unavailable entries redact former public metadata but remain removable.

Approved authors use `GET`/`PATCH /authors/me/profile` with `{penName,bio}` and `GET /authors/me/analytics`. Account profile changes whitelist username, nickname, bio and isPrivate; email and roles cannot be changed there. Partial updates preserve omitted fields. Username conflicts return 409. See [privacy and cursor policy](../architecture/READER_LIBRARY.md).
