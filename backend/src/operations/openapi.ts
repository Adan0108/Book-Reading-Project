import YAML from "yamljs";
import path from "node:path";
type Schema = Record<string, unknown>;
type Operation = Record<string, unknown>;
interface Document {
  openapi: string;
  info: Record<string, unknown>;
  servers: unknown[];
  tags: unknown[];
  paths: Record<string, Record<string, Operation>>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, Schema>;
  };
}
const text = (maxLength?: number): Schema => ({
  type: "string",
  ...(maxLength ? { maxLength } : {}),
});
const id: Schema = { type: "integer", minimum: 1 },
  bool: Schema = { type: "boolean" },
  uuid: Schema = { type: "string", format: "uuid" },
  money: Schema = { type: "integer", minimum: 0 };
const enumeration = (...values: string[]): Schema => ({
  type: "string",
  enum: values,
});
const ref = (name: string): Schema => ({
  $ref: `#/components/schemas/${name}`,
});
const array = (items: Schema, maxItems?: number): Schema => ({
  type: "array",
  items,
  ...(maxItems ? { maxItems } : {}),
});
const object = (
  properties: Record<string, Schema>,
  required: string[] = [],
): Schema => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
});
const page = (items: Schema) =>
  object({
    items: array(items),
    nextCursor: { anyOf: [{ ...id, nullable: true }, text()] },
  });
const envelope = (metadata: Schema) =>
  object({ message: text(), status: { type: "integer" }, metadata }, [
    "message",
    "status",
    "metadata",
  ]);
const json = (schema: Schema) => ({ "application/json": { schema } });
const query = (name: string, schema: Schema = text()) => ({
  in: "query",
  name,
  schema,
});
export function createOpenApiDocument(): Document {
  const doc = YAML.load(
    path.join(__dirname, "../docs/swagger.yaml"),
  ) as Document;
  doc.info = {
    title: "HiBook API",
    version: "2.0.0",
    description:
      "Text-first publishing, author-specific memberships, sandbox payments, private chat and moderation. Business routes use Bearer + x-client-id, not ambient cookies. API content responses are no-store. Stripe redirects never grant access. Socket.IO is documented separately in docs/architecture/MEMBER_CHAT.md.",
  };
  doc.servers = [
    {
      url: "/",
      description: "Current application origin (gateway or direct API)",
    },
  ];
  const schemas: Record<string, Schema> = {
    Error: object({ status: enumeration("error"), message: text() }, [
      "message",
    ]),
    Image: object(
      { id: uuid, imageUrl: { type: "string", format: "uri" }, pageOrder: id },
      ["id", "imageUrl", "pageOrder"],
    ),
    Story: object(
      {
        id,
        slug: text(),
        title: text(),
        synopsis: { type: "string", nullable: true },
        coverUrl: { type: "string", nullable: true },
        genre: text(),
        authorId: id,
        authorName: text(),
        viewsCount: money,
        totalChapters: money,
        visibility: enumeration("PUBLIC", "MEMBERS", "TIERS"),
      },
      ["id", "slug", "title"],
    ),
    Author: object({
      id,
      penName: text(),
      bio: text(),
      bookCount: money,
      followerCount: money,
      isFollowing: bool,
      isOwner: bool,
    }),
    AccountProfile: object({
      id,
      email: { type: "string", format: "email" },
      username: text(),
      nickname: text(),
      bio: text(),
      isPrivate: bool,
    }),
    Inline: object(
      {
        type: enumeration("text", "link"),
        text: text(),
        href: text(),
        styles: object({
          bold: bool,
          italic: bool,
          underline: bool,
          strike: bool,
        }),
        content: array(
          object({
            type: enumeration("text"),
            text: text(),
            styles: { type: "object" },
          }),
        ),
      },
      ["type"],
    ),
    Block: object(
      {
        id: text(100),
        type: enumeration(
          "paragraph",
          "heading",
          "quote",
          "divider",
          "authorNote",
          "illustration",
        ),
        props: object({
          level: { type: "integer", minimum: 1, maximum: 3 },
          assetId: uuid,
          caption: text(),
          textAlignment: enumeration("left", "center", "right", "justify"),
        }),
        content: array(ref("Inline")),
        children: array(ref("Block")),
      },
      ["id", "type", "props", "children"],
    ),
    NovelDocument: {
      ...object(
        {
          version: { type: "integer", enum: [1] },
          blocks: array(ref("Block"), 2000),
        },
        ["version", "blocks"],
      ),
      description:
        "Canonical version 1 document, maximum 512 KiB, 2,000 total blocks and depth 8. Illustration asset IDs must be confirmed and match ordered image references. Raw HTML is not supported.",
    },
    Chapter: object({
      id,
      bookId: id,
      index: id,
      title: text(),
      contentMarkdown: text(),
      contentDocument: {
        type: "object",
        nullable: true,
        description: "Canonical NovelDocument, or null for legacy Markdown.",
      },
      images: array(ref("Image")),
      visibility: enumeration("PUBLIC", "MEMBERS", "TIERS"),
      isDraft: bool,
    }),
    BookWrite: object({
      title: text(255),
      genre: text(255),
      synopsis: text(),
      status: enumeration("DRAFT", "PUBLISHED", "HIDDEN"),
      visibility: enumeration("PUBLIC", "MEMBERS", "TIERS"),
      requiredTierIds: array(id),
      tags: array(text(100), 30),
      coverAssetId: uuid,
      removeCover: bool,
      requestId: uuid,
    }),
    ChapterWrite: object({
      title: text(255),
      contentMd: text(),
      contentDocument: ref("NovelDocument"),
      imageAssetIds: array(uuid, 100),
      visibility: enumeration("PUBLIC", "MEMBERS", "TIERS"),
      requiredTierIds: array(id),
      isDraft: bool,
      scheduledAt: { type: "string", format: "date-time", nullable: true },
      requestId: uuid,
    }),
    PostWrite: object({
      title: text(180),
      body: text(20000),
      visibility: enumeration("PUBLIC", "MEMBERS", "TIERS"),
      minimumTierId: id,
      isDraft: bool,
      isSpoiler: bool,
      imageAssetIds: array(uuid, 8),
      requestId: uuid,
    }),
    Post: object({
      id,
      authorId: id,
      title: text(),
      body: text(),
      isSpoiler: bool,
      isDraft: bool,
      isLocked: bool,
      visibility: enumeration("PUBLIC", "MEMBERS", "TIERS"),
      images: array(ref("Image")),
      publishedAt: { type: "string", format: "date-time" },
    }),
    Tier: object({
      id,
      authorId: id,
      level: { type: "integer", nullable: true },
      name: text(),
      description: text(),
      benefits: array(text()),
      priceCents: money,
      currency: enumeration("USD"),
      available: bool,
      pricingVersion: id,
    }),
    TierWrite: object(
      {
        name: text(80),
        description: text(2000),
        benefits: array(text(200), 12),
        available: bool,
        existingTierId: id,
      },
      ["name"],
    ),
    MembershipPolicy: object({
      currency: enumeration("USD"),
      tierOneName: text(80),
      tierTwoName: text(80),
      tierOneCents: { type: "integer", minimum: 100, maximum: 1000000 },
      tierTwoCents: { type: "integer", minimum: 100, maximum: 1000000 },
      tierTwoEnabled: bool,
      revenueShareBps: { type: "integer", minimum: 0, maximum: 10000 },
      version: id,
    }),
    Membership: object({
      id,
      authorId: id,
      authorName: text(),
      tierName: text(),
      status: text(),
      provider: text(),
      autoRenew: bool,
      hasAccess: bool,
      currentPeriodEnd: { type: "string", format: "date-time" },
    }),
    CheckoutWrite: {
      oneOf: [
        object(
          {
            requestId: uuid,
            kind: enumeration("MEMBERSHIP"),
            authorId: id,
            tierId: id,
          },
          ["requestId", "kind", "authorId", "tierId"],
        ),
        object(
          {
            requestId: uuid,
            kind: enumeration("DONATION"),
            authorId: id,
            amountCents: { type: "integer", minimum: 100, maximum: 100000 },
          },
          ["requestId", "kind", "authorId", "amountCents"],
        ),
      ],
    },
    Payment: object({
      id,
      kind: enumeration("MEMBERSHIP", "DONATION"),
      grossCents: money,
      refundedCents: money,
      platformCents: money,
      authorCents: money,
      currency: enumeration("USD"),
      authorName: text(),
      createdAt: { type: "string", format: "date-time" },
    }),
    Conversation: object({
      id,
      authorId: id,
      memberId: id,
      peerName: text(),
      unreadCount: money,
      canSend: bool,
    }),
    Message: object({
      id,
      conversationId: id,
      senderId: id,
      clientId: uuid,
      text: text(4000),
      createdAt: { type: "string", format: "date-time" },
    }),
    Report: object({
      id,
      kind: enumeration("BOOK", "CHAPTER", "POST"),
      resourceId: id,
      reason: text(),
      status: enumeration("OPEN", "REVIEWING", "RESOLVED", "DISMISSED"),
      resolution: { type: "string", nullable: true },
      version: id,
    }),
    ModerationPolicy: object({
      reportsEnabled: bool,
      reportsPerDay: { type: "integer", minimum: 1, maximum: 20 },
      version: id,
      reason: text(2000),
    }),
    ApplicationWrite: object(
      {
        penName: text(),
        applicationTitle: { type: "string", minLength: 5 },
        sampleTitle: { type: "string", minLength: 3 },
        sampleStory: { type: "string", minLength: 800 },
        bio: text(),
        motivation: text(),
        genres: array(text()),
        portfolioLinks: array(text()),
      },
      ["applicationTitle", "sampleTitle", "sampleStory"],
    ),
    Application: object({
      id,
      status: enumeration(
        "PENDING",
        "UNDER_REVIEW",
        "APPROVED",
        "REJECTED",
        "WITHDRAWN",
      ),
      penName: text(),
      applicationTitle: text(),
      sampleTitle: text(),
      sampleStory: text(),
      decisionReason: text(),
    }),
    LibraryEntry: {
      ...object({
        id,
        title: { type: "string", nullable: true },
        slug: { type: "string", nullable: true },
        authorId: id,
        chapterId: id,
        chapterNo: id,
        progress: { type: "integer", minimum: 0, maximum: 100 },
        available: bool,
      }),
      description:
        "Exact fields depend on bookmarks/follows/history. Unavailable entries retain removable identity but redact former public titles, covers and links. No chapter body is returned.",
    },
  };
  doc.components.schemas = { ...(doc.components.schemas ?? {}), ...schemas };
  doc.components.securitySchemes.stripeSignature = {
    type: "apiKey",
    in: "header",
    name: "Stripe-Signature",
    description:
      "Provider signature over exact raw request bytes; only fresh sandbox events accepted.",
  };
  const errors: Record<string, unknown> = Object.fromEntries(
    [
      [400, "Invalid fields or unsupported operation"],
      [401, "Missing, expired or revoked identity"],
      [403, "Role, ownership, entitlement or origin denied"],
      [404, "Unavailable resource"],
      [409, "Conflicting key, stale version or existing operation"],
      [413, "Request exceeds the supported body limit"],
      [429, "Rate limit reached"],
      [500, "Unexpected server error; no internal details returned"],
      [502, "Provider verification failed"],
      [503, "Required service or provider unavailable"],
    ].map(([code, description]) => [
      String(code),
      { description, content: json(ref("Error")) },
    ]),
  );
  function route(
    method: string,
    url: string,
    tag: string,
    summary: string,
    response: Schema = object({}),
    body?: Schema,
    access: "public" | "optional" | "account" | "author" | "admin" = "account",
    parameters: unknown[] = [],
  ) {
    const full = `/v1/api${url}`;
    const paths = [...url.matchAll(/\{([^}]+)\}/g)].map(([, name]) => ({
      in: "path",
      name,
      required: true,
      schema:
        name === "kind"
          ? enumeration("BOOK", "CHAPTER", "POST")
          : name === "slug"
            ? text()
            : name === "checkoutId"
              ? uuid
              : name === "level"
                ? { type: "integer", enum: [1, 2] }
                : id,
    }));
    const operation: Operation = {
      tags: [tag],
      summary,
      description: `${access === "author" ? "Approved author role/profile and owned resource required. " : access === "admin" ? "ADMIN role required. " : access === "optional" ? "Guest access allowed; include both credentials for member content. " : ""}All identifiers, prices and entitlements are validated server-side.`,
      security:
        access === "public"
          ? []
          : access === "optional"
            ? [{}, { bearerAuth: [], clientId: [] }]
            : [{ bearerAuth: [], clientId: [] }],
      responses: {
        200: { description: "Success", content: json(envelope(response)) },
        ...errors,
      },
    };
    if (paths.length || parameters.length)
      operation.parameters = [...paths, ...parameters];
    if (body) operation.requestBody = { required: true, content: json(body) };
    (doc.paths[full] ??= {})[method] = operation;
  }
  const cursor = [query("cursor")],
    paging = [
      query("query", text(100)),
      query("page", id),
      query("limit", { type: "integer", minimum: 1, maximum: 50 }),
    ];
  route(
    "get",
    "/user/me",
    "Account",
    "Current identity and roles",
    object({ id, email: text(), roles: array(text()) }),
  );
  route(
    "get",
    "/user/me/profile",
    "Account",
    "Private account profile",
    ref("AccountProfile"),
  );
  route(
    "patch",
    "/user/me/profile",
    "Account",
    "Update caller profile; email/roles are immutable",
    ref("AccountProfile"),
    object({
      username: text(50),
      nickname: text(100),
      bio: text(5000),
      isPrivate: bool,
    }),
  );
  route(
    "get",
    "/discovery/filters",
    "Discovery",
    "Visible genre and tag facets",
    object({
      genres: array(text()),
      tags: array(object({ slug: text(), name: text() })),
    }),
    undefined,
    "public",
  );
  route(
    "get",
    "/books",
    "Discovery",
    "Search published stories",
    object({ items: array(ref("Story")), page: id, limit: id, total: money }),
    undefined,
    "public",
    [
      ...paging,
      query("genre"),
      query("tag"),
      query("sort", enumeration("recent", "popular", "updated")),
    ],
  );
  route(
    "get",
    "/books/{authorId}/books",
    "Discovery",
    "Published books by author",
    object({ items: array(ref("Story")), page: id, limit: id, total: money }),
    undefined,
    "public",
    paging,
  );
  route(
    "get",
    "/books/{slug}",
    "Books",
    "Visible book metadata and chapter summaries",
    ref("Story"),
    undefined,
    "optional",
  );
  route(
    "get",
    "/books/{slug}/chapters",
    "Books",
    "Table of contents with lock indicators",
    object({
      bookId: id,
      slug: text(),
      items: array(object({ index: id, title: text(), isLocked: bool })),
    }),
    undefined,
    "optional",
  );
  route(
    "get",
    "/books/{slug}/chapters/{index}",
    "Books",
    "Read after parent and chapter entitlement checks",
    ref("Chapter"),
    undefined,
    "optional",
  );
  route(
    "get",
    "/authors/{id}/profile",
    "Authors",
    "Explicit public author profile, including zero-book authors",
    ref("Author"),
    undefined,
    "optional",
  );
  route(
    "get",
    "/authors/me/profile",
    "Authors",
    "Owned public author profile",
    object({ id, penName: text(), bio: text() }),
    undefined,
    "author",
  );
  route(
    "patch",
    "/authors/me/profile",
    "Authors",
    "Update public pen name and biography",
    object({ id, penName: text(), bio: text() }),
    object({ penName: text(255), bio: text(5000) }),
    "author",
  );
  route(
    "get",
    "/authors/me/analytics",
    "Authors",
    "Actual owned publication and audience statistics",
    object({
      books: money,
      recordedBookViews: money,
      releasedChapters: money,
      followers: money,
      eligibleMemberships: money,
    }),
    undefined,
    "author",
  );
  route(
    "put",
    "/authors/{id}/follow",
    "Library",
    "Set caller follow state",
    object({ authorId: id, followed: bool }),
    object({ followed: bool }, ["followed"]),
  );
  for (const name of ["bookmarks", "follows", "history"])
    route(
      "get",
      `/library/${name}`,
      "Library",
      `Private ${name}`,
      page(ref("LibraryEntry")),
      undefined,
      "account",
      cursor,
    );
  route(
    "get",
    "/library/books/{id}",
    "Library",
    "Caller bookmark and most recent reading state",
    object({
      bookmarked: bool,
      lastRead: { ...ref("LibraryEntry"), nullable: true },
    }),
  );
  route(
    "put",
    "/library/bookmarks/{id}",
    "Library",
    "Set caller bookmark state",
    object({ bookmarked: bool }),
    object({ bookmarked: bool }, ["bookmarked"]),
  );
  route(
    "post",
    "/library/history",
    "Library",
    "Record accessible chapter progress without granting rights",
    object({ chapterId: id, progress: money }),
    object(
      {
        chapterId: id,
        progress: { type: "integer", minimum: 0, maximum: 100 },
      },
      ["chapterId", "progress"],
    ),
  );
  route(
    "delete",
    "/library/history/{id}",
    "Library",
    "Remove caller chapter history",
    object({ chapterId: id }),
  );
  route(
    "get",
    "/authors/me/books",
    "Publishing",
    "Owned books",
    object({ items: array(ref("Story")), total: money, page: id, limit: id }),
    undefined,
    "author",
    [...paging, query("status", enumeration("DRAFT", "PUBLISHED", "HIDDEN"))],
  );
  route(
    "get",
    "/authors/me/books/{bookId}",
    "Publishing",
    "Owned book and draft chapters",
    ref("Story"),
    undefined,
    "author",
  );
  route(
    "post",
    "/authors/me/books",
    "Publishing",
    "Create book; stable requestId recommended",
    object({ id, slug: text() }),
    { ...schemas.BookWrite, required: ["title", "genre"] },
    "author",
  );
  route(
    "patch",
    "/authors/me/books/{bookId}",
    "Publishing",
    "Update book without replacing omitted fields",
    object({ id, slug: text() }),
    ref("BookWrite"),
    "author",
  );
  route(
    "post",
    "/authors/me/books/{bookId}/chapters",
    "Publishing",
    "Create draft or publish text/document and optional images",
    object({ chapterId: id, chapterNo: id, bookId: id, slug: text() }),
    { ...schemas.ChapterWrite, required: ["title"] },
    "author",
  );
  route(
    "get",
    "/authors/me/books/{bookId}/chapters/{chapterId}",
    "Publishing",
    "Owned chapter document and confirmed artwork",
    ref("Chapter"),
    undefined,
    "author",
  );
  route(
    "patch",
    "/authors/me/books/{bookId}/chapters/{chapterId}",
    "Publishing",
    "Save chapter transactionally with stable requestId",
    object({ chapterId: id, chapterNo: id, bookId: id, slug: text() }),
    ref("ChapterWrite"),
    "author",
  );
  route(
    "post",
    "/upload/fan-art/authorize",
    "Media",
    "Authorize direct signed upload; no file bytes pass through API",
    object({
      id: uuid,
      cloudName: text(),
      apiKey: text(),
      params: { type: "object" },
      signature: text(),
    }),
    object(
      {
        purpose: enumeration("cover", "chapter", "post"),
        mimeType: enumeration("image/jpeg", "image/png", "image/webp"),
        size: { type: "integer", minimum: 1, maximum: 10485760 },
        bookId: id,
      },
      ["purpose", "mimeType", "size"],
    ),
    "author",
  );
  route(
    "post",
    "/upload/fan-art/confirm",
    "Media",
    "Confirm server-assigned asset through provider lookup",
    object({ id: uuid, imageUrl: text() }),
    object({ assetId: uuid }, ["assetId"]),
    "author",
  );
  route(
    "get",
    "/membership-policy",
    "Memberships",
    "Current platform pricing and revenue share",
    ref("MembershipPolicy"),
    undefined,
    "author",
  );
  route(
    "put",
    "/admin/membership-policy",
    "Administration",
    "Versioned audited pricing policy",
    ref("MembershipPolicy"),
    ref("MembershipPolicy"),
    "admin",
  );
  route(
    "get",
    "/authors/{authorId}/tiers",
    "Memberships",
    "Available managed tier offers (not grants)",
    object({ authorId: id, authorName: text(), tiers: array(ref("Tier")) }),
    undefined,
    "public",
  );
  route(
    "get",
    "/authors/me/tiers",
    "Memberships",
    "Owned managed and legacy tiers",
    object({
      authorId: id,
      tiers: array(ref("Tier")),
      policy: ref("MembershipPolicy"),
    }),
    undefined,
    "author",
  );
  route(
    "put",
    "/authors/me/tiers/{level}",
    "Memberships",
    "Configure one of at most two managed tiers",
    object({ authorId: id, tier: ref("Tier") }),
    ref("TierWrite"),
    "author",
  );
  route(
    "get",
    "/authors/me/members",
    "Memberships",
    "Owned members and current eligibility",
    page(ref("Membership")),
    undefined,
    "author",
    cursor,
  );
  route(
    "get",
    "/memberships/me",
    "Memberships",
    "Caller memberships and current access",
    object({ items: array(ref("Membership")) }),
  );
  route(
    "post",
    "/memberships/{membershipId}/cancel",
    "Memberships",
    "Cancel renewal of caller-owned manual membership",
    object({ id, autoRenew: bool, status: text() }),
  );
  route(
    "get",
    "/authors/me/posts",
    "Posts",
    "Owned posts including drafts and moderation notices",
    page(ref("Post")),
    undefined,
    "author",
    cursor,
  );
  route(
    "post",
    "/authors/me/posts",
    "Posts",
    "Create text update with optional ordered artwork",
    object({ id, authorId: id, isDraft: bool }),
    ref("PostWrite"),
    "author",
  );
  route(
    "patch",
    "/authors/me/posts/{postId}",
    "Posts",
    "Edit owned update with idempotent save key",
    object({ id, authorId: id, isDraft: bool }),
    ref("PostWrite"),
    "author",
  );
  route(
    "get",
    "/authors/{authorId}/posts",
    "Posts",
    "Published teasers; omit locked text and image URLs",
    page(ref("Post")),
    undefined,
    "optional",
    cursor,
  );
  route(
    "get",
    "/authors/{authorId}/posts/{postId}",
    "Posts",
    "Authorized post body, spoiler flag and artwork",
    ref("Post"),
    undefined,
    "optional",
  );
  route(
    "get",
    "/payments/configuration",
    "Payments",
    "Public integration availability, no credentials",
    object({
      configured: bool,
      mode: enumeration("sandbox", "fixture"),
      provider: text(),
      currency: text(),
    }),
    undefined,
    "public",
  );
  route(
    "post",
    "/payments/checkout",
    "Payments",
    "Server-priced sandbox membership or donation checkout",
    object({
      id: uuid,
      url: { type: "string", format: "uri" },
      mode: enumeration("sandbox", "fixture"),
    }),
    ref("CheckoutWrite"),
  );
  route(
    "get",
    "/payments/checkout/{checkoutId}",
    "Payments",
    "Caller-owned checkout status; redirects do not grant access",
    object({
      id: uuid,
      kind: text(),
      state: enumeration(
        "PENDING",
        "PAID",
        "PARTIALLY_REFUNDED",
        "REFUNDED",
        "EXPIRED",
      ),
    }),
  );
  route(
    "get",
    "/payments/me",
    "Payments",
    "Caller ledger history and totals",
    page(ref("Payment")),
    undefined,
    "account",
    cursor,
  );
  route(
    "get",
    "/authors/me/payments",
    "Payments",
    "Owned author income history and totals",
    page(ref("Payment")),
    undefined,
    "author",
    cursor,
  );
  route(
    "post",
    "/payments/memberships/{membershipId}/cancel",
    "Payments",
    "Provider-confirmed cancellation at paid period end",
    object({ id, autoRenew: bool }),
  );
  route(
    "get",
    "/admin/payments/reconciliation",
    "Administration",
    "Read-only sandbox ledger reconciliation",
    object({
      currency: text(),
      mode: text(),
      totals: { type: "object" },
      unconfirmedExpired: array({ type: "object" }),
      note: text(),
    }),
    undefined,
    "admin",
  );
  route(
    "post",
    "/payments/stripe/webhook",
    "Payments",
    "Raw signed sandbox webhook; commit before acknowledgment",
    object({ received: bool, duplicate: bool }),
    { type: "object" },
    "public",
  );
  doc.paths["/v1/api/payments/stripe/webhook"].post.security = [
    { stripeSignature: [] },
  ];
  doc.paths["/v1/api/payments/stripe/webhook"].post.responses = {
    200: {
      description: "Committed or already processed",
      content: json(object({ received: bool, duplicate: bool })),
    },
    ...errors,
  };
  route(
    "get",
    "/chat/conversations",
    "Chat",
    "Participant-only summaries and unread counts",
    page(ref("Conversation")),
    undefined,
    "account",
    cursor,
  );
  route(
    "post",
    "/chat/conversations",
    "Chat",
    "Create/retrieve eligible author-member conversation",
    object({ id, authorId: id, memberId: id }),
    object({ authorId: id, memberId: id }, ["authorId"]),
  );
  route(
    "get",
    "/chat/conversations/{id}/messages",
    "Chat",
    "Participant history; expired readers cannot retrieve it",
    {
      ...page(ref("Message")),
      description:
        "Chronological page with canSend and peerLastReadId. Authors retain their own history after member expiry.",
    },
    undefined,
    "account",
    cursor,
  );
  route(
    "post",
    "/chat/conversations/{id}/messages",
    "Chat",
    "Persist once per sender/client UUID; maximum 30/minute",
    ref("Message"),
    object({ clientId: uuid, text: text(4000) }, ["clientId", "text"]),
  );
  route(
    "post",
    "/chat/conversations/{id}/read",
    "Chat",
    "Advance caller read position monotonically",
    object({ lastReadId: id }),
    object({ messageId: id }, ["messageId"]),
  );
  route(
    "post",
    "/reports",
    "Moderation",
    "Report available content; repeated open reports deduplicate",
    object({ id, status: text() }),
    object(
      {
        kind: enumeration("BOOK", "CHAPTER", "POST"),
        resourceId: id,
        reason: text(2000),
      },
      ["kind", "resourceId", "reason"],
    ),
  );
  route(
    "get",
    "/admin/dashboard",
    "Administration",
    "Actual platform operational counts",
    object({
      totalUsers: money,
      totalAuthors: money,
      publishedBooks: money,
      publishedChapters: money,
      recordedBookViews: money,
      activeMemberships: money,
      sandboxDonationCents: money,
      openReports: money,
      currency: enumeration("USD"),
      financialMode: enumeration("sandbox"),
    }),
    undefined,
    "admin",
  );
  route(
    "get",
    "/admin/users",
    "Administration",
    "Account list without credentials",
    page(
      object({
        id,
        email: text(),
        username: text(),
        state: { type: "integer" },
        roles: array(text()),
      }),
    ),
    undefined,
    "admin",
    [...cursor, query("query"), query("role")],
  );
  route(
    "patch",
    "/admin/users/{id}/state",
    "Administration",
    "Suspend/restore; suspension revokes sessions atomically",
    object({ id, active: bool }),
    object(
      {
        active: bool,
        expectedState: { type: "integer", enum: [0, 1] },
        reason: text(2000),
      },
      ["active", "expectedState", "reason"],
    ),
    "admin",
  );
  route(
    "get",
    "/admin/content",
    "Administration",
    "Content list with independent moderation state",
    page(object({ id, title: text(), hidden: bool, moderationVersion: money })),
    undefined,
    "admin",
    [
      ...cursor,
      query("kind", enumeration("BOOK", "CHAPTER", "POST")),
      query("query"),
    ],
  );
  route(
    "get",
    "/admin/content/{kind}/{id}",
    "Administration",
    "Hidden content preview for moderation",
    object({
      id,
      title: text(),
      text: text(),
      contentDocument: ref("NovelDocument"),
      images: array(ref("Image")),
    }),
    undefined,
    "admin",
  );
  route(
    "patch",
    "/admin/content/{kind}/{id}",
    "Administration",
    "Versioned audited hide/restore, independent of drafts",
    object({ hidden: bool, version: id }),
    object({ hidden: bool, version: money, reason: text(2000) }, [
      "hidden",
      "version",
      "reason",
    ]),
    "admin",
  );
  route(
    "get",
    "/admin/reports",
    "Administration",
    "Report review queue",
    page(ref("Report")),
    undefined,
    "admin",
    [
      ...cursor,
      query(
        "status",
        enumeration("OPEN", "REVIEWING", "RESOLVED", "DISMISSED"),
      ),
    ],
  );
  route(
    "patch",
    "/admin/reports/{id}",
    "Administration",
    "Versioned report review; closed reports immutable",
    ref("Report"),
    object(
      {
        status: enumeration("REVIEWING", "RESOLVED", "DISMISSED"),
        version: id,
        reason: text(2000),
      },
      ["status", "version", "reason"],
    ),
    "admin",
  );
  route(
    "get",
    "/admin/moderation-policy",
    "Administration",
    "Report availability and quotas",
    ref("ModerationPolicy"),
    undefined,
    "admin",
  );
  route(
    "put",
    "/admin/moderation-policy",
    "Administration",
    "Versioned audited reporting policy",
    ref("ModerationPolicy"),
    ref("ModerationPolicy"),
    "admin",
  );
  route(
    "get",
    "/admin/audit",
    "Administration",
    "Read-only administrative audit history",
    page(
      object({
        id,
        action: text(),
        target: text(),
        details: { type: "object" },
      }),
    ),
    undefined,
    "admin",
    cursor,
  );
  route(
    "post",
    "/author-applications",
    "Applications",
    "Submit writing sample for approval",
    ref("Application"),
    ref("ApplicationWrite"),
  );
  const submit = doc.paths["/v1/api/author-applications"].post;
  submit.responses = {
    201: {
      description: "Created",
      content: json(envelope(ref("Application"))),
    },
    ...errors,
  };
  route(
    "get",
    "/author-applications/me/latest",
    "Applications",
    "Caller latest author application",
    ref("Application"),
  );
  route(
    "patch",
    "/author-applications/{id}/withdraw",
    "Applications",
    "Withdraw caller-owned pending application",
    ref("Application"),
  );
  route(
    "get",
    "/admin/author-applications",
    "Applications",
    "Administrative application queue",
    page(ref("Application")),
    undefined,
    "admin",
    [...paging, query("status")],
  );
  route(
    "get",
    "/admin/author-applications/{id}",
    "Applications",
    "Administrative writing sample review",
    ref("Application"),
    undefined,
    "admin",
  );
  route(
    "patch",
    "/admin/author-applications/{id}/mark-under-review",
    "Applications",
    "Begin application review",
    ref("Application"),
    undefined,
    "admin",
  );
  route(
    "post",
    "/admin/author-applications/{id}/approve",
    "Applications",
    "Approve and provision author profile and role transactionally",
    ref("Application"),
    object({ decisionReason: text(), internalNotes: text() }),
    "admin",
  );
  route(
    "post",
    "/admin/author-applications/{id}/reject",
    "Applications",
    "Reject application with reader-visible reason",
    ref("Application"),
    object({ decisionReason: text(), internalNotes: text() }),
    "admin",
  );
  route(
    "post",
    "/upload/fan-art",
    "Legacy media",
    "Legacy buffered chapter fan-art upload (new editors use authorize/confirm)",
    object({ fanArtId: id, url: text(), width: id, height: id }),
    undefined,
    "account",
  );
  const legacyUpload = doc.paths["/v1/api/upload/fan-art"].post;
  legacyUpload.deprecated = true;
  legacyUpload.requestBody = {
    required: true,
    content: {
      "multipart/form-data": {
        schema: object(
          { file: { type: "string", format: "binary" }, chapterId: id },
          ["file", "chapterId"],
        ),
      },
    },
  };
  route(
    "delete",
    "/delete/fan-art/{id}",
    "Legacy media",
    "Legacy owned fan-art deletion; not used by the new publishing lifecycle",
    object({ message: text() }),
  );
  doc.paths["/v1/api/delete/fan-art/{id}"].delete.deprecated = true;
  for (const name of ["live", "ready"])
    doc.paths[`/health/${name}`] = {
      get: {
        summary:
          name === "live" ? "Process liveness" : "Schema/dependency readiness",
        tags: ["Operations"],
        security: [],
        responses: {
          200: {
            description: "Healthy",
            content: json(
              object({
                status: text(),
                ready: bool,
                database: bool,
                redis: bool,
                schema: bool,
                draining: bool,
              }),
            ),
          },
          503: {
            description: "Not ready",
            content: json(
              object({
                ready: bool,
                database: bool,
                redis: bool,
                schema: bool,
                draining: bool,
              }),
            ),
          },
        },
      },
    };
  for (const [url, item] of Object.entries(doc.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      if (url.startsWith("/v1/api/access/")) {
        operation.responses = {
          [url.endsWith("/setup-password") ? "201" : "200"]: {
            description:
              "Success; login/session/refresh return metadata.tokens; verify returns a caller-bound setup proof.",
            content: json(
              envelope(
                object({
                  user: object({ id, email: text(), roles: array(text()) }),
                  tokens: object({ accessToken: text() }),
                  setupToken: text(),
                  userId: id,
                }),
              ),
            ),
          },
          ...errors,
        };
      }
    }
  }
  doc.tags = [
    ...new Set(
      Object.values(doc.paths).flatMap((item) =>
        Object.values(item).flatMap((operation) =>
          Array.isArray(operation.tags) ? (operation.tags as string[]) : [],
        ),
      ),
    ),
  ].map((name) => ({ name }));
  return doc;
}
