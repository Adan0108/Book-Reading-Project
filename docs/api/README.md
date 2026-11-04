# API documentation

Run the application and open `/api-docs/`. Download the same OpenAPI 3.0 contract from `/api-docs/openapi.json`. The document composes the existing authentication contract with schemas and operations for discovery, accounts, authors, publishing/media, posts, library, memberships, payments/donations, chat, moderation and administration. Legacy buffered media routes are explicitly deprecated; current editors use signed direct uploads.

Business paths start at `/v1/api`. Success generally uses `{message,status,metadata}`; the raw Stripe webhook acknowledges `{received,duplicate}`, and health endpoints return direct readiness objects. Legacy media keeps its old envelope. Protected requests require **both** `Authorization: Bearer <access token>` and `x-client-id`. The stored user ID is not a credential. Author/admin role checks and ownership still apply. Optional-auth readers may omit both credentials; supplied invalid credentials are rejected rather than silently downgraded.

Session restoration/refresh use HttpOnly cookies plus the ID header and trusted browser Origin. Cross-origin clients need credentials enabled. Browsers cannot manually set an HttpOnly cookie through Swagger; authenticate through the application or an appropriate test client. Never paste production credentials into shared tooling.

`400` rejects invalid fields; `401` rejects identity; `403` rejects access/origin; `404` hides unavailable resources; `409` reports conflicting retry keys or stale versions; `413` rejects oversized bodies; `429` applies bounded rates; and `503` indicates a required security/provider dependency is unavailable. See [implemented contracts and compatibility notes](../mvp/API_CONTRACTS.md).

Checkout and message writes require stable UUID keys. Publishing/post clients should supply stable save UUIDs and retain them after uncertain responses. API redirects are never payment proof. The Stripe route consumes raw bytes and its signature before JSON middleware. Monetary amounts use integer USD cents and policy snapshots. Socket.IO authentication, events, privacy and recovery are covered in [chat architecture](../architecture/MEMBER_CHAT.md), not represented as REST endpoints.

`/health/live` reports process liveness; `/health/ready` verifies schema initialization, MySQL, Redis and draining state. Readiness does not prove external SMTP/Stripe/Cloudinary availability or deployment security. OpenAPI parser tests validate schema references; service/HTTP/browser tests provide behavior evidence rather than treating documentation as runtime validation.
