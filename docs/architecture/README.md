# Architecture

HiBook is a TypeScript modular monolith. React uses a single Express API and Socket.IO server. MySQL owns durable content, sessions, access grants and the financial journal; Redis holds bounded caches, rate limits and revocation hints. Cloudinary handles direct signed uploads. Stripe integration accepts sandbox credentials only.

Controllers and route handlers translate HTTP into service calls. Services enforce explicit rules and transaction boundaries. Repositories centralize reused SQL, especially publication visibility, memberships and ordered assets. The payment provider adapter is a small dependency-injection boundary for external I/O; ordinary CRUD does not use interface/factory boilerplate. Chat events are local delivery hints, with MySQL history as the recovery source. Running multiple backend instances requires a reviewed socket adapter and delivery policy.

| Design | Detailed decision and evidence |
|---|---|
| Durable JWT sessions and proof-bound setup | [Authentication](../security/AUTH_SESSIONS.md) |
| Mature block editor, canonical documents and local-first media | [Writing studio](WRITING_STUDIO.md) |
| Transactional publishing and signed intent confirmation | [Publishing report](../publishing/PUBLISHING_REPORT.md) |
| Author-specific access and tier hierarchy | [Memberships](MEMBERSHIPS.md) |
| Provider adapter, webhook integrity, invoice windows and refunds | [Payments](PAYMENTS.md) |
| Persisted member conversations and fresh delivery authorization | [Chat](MEMBER_CHAT.md) |
| Independent moderation state and transactional audit | [Moderation](ADMIN_MODERATION.md) |
| Real catalog, public/private profiles and scoped history | [Reader library](READER_LIBRARY.md) |
| Text posts, spoilers and optional artwork | [Author updates](AUTHOR_POSTS.md) |

There is no message broker, microservice topology or generic event framework. Browser files and unsent chat drafts remain in memory. Public image URLs are not DRM. These choices and limits are documented rather than hidden behind infrastructure claims.
