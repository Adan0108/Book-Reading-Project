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

Payment/chat/moderation contracts will be added when implemented and verified.
