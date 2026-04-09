import { BadRequestError, ForbiddenError, NotFoundError, AuthFailureError } from '../core/error.response';
import * as bookRepo from '../models/repositories/book.repo';
import * as chapterRepo from '../models/repositories/chapter.repo';
import * as tagRepo from '../models/repositories/tag.repo';
import * as authorRepo from '../models/repositories/author.repo';
import * as membershipRepo from '../models/repositories/membership.repo';
import { cacheDel, cacheGetJson, cacheIncr, cacheSetJson,cacheSetNx } from '../utils/cache';

const BOOK_TTL = 60;      // seconds
const CHAPTER_TTL = 60;   // seconds
const BOOK_VIEW_WINDOW = 60 * 30;  // 30 minutes

const slugify = (s: string) =>
  s.toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const listBooksPublic = async (q: { query?: string; page?: any; limit?: any }) => {
  const page = Math.max(1, Number(q.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(q.limit ?? 20)));

  const { items, total } = await bookRepo.listBooksPublic({ query: q.query, page, limit });

  return {
    page,
    limit,
    total,
    items: items.map((b: any) => ({
      id: b.id,
      slug: b.slug,
      title: b.title,
      synopsis: b.synopsis,
      coverUrl: b.coverUrl,
      authorName: b.authorName,
      viewsCount: Number(b.viewsCount ?? 0),
      totalChapters: Number(b.totalChapters ?? 0),
      hasMembersOnlyChapters: Number(b.membersOnlyChapters ?? 0) > 0,
    })),
  };
};

export const getBookDetailBySlug = async (
  slug: string,
  viewer?: { viewerUserId?: number; viewerIp?: string }
) => {
  if (!slug?.trim()) throw new BadRequestError('slug is required');

  const cacheKey = `book:${slug}`;
  const cached = await cacheGetJson<any>(cacheKey);

  // Build viewer key
  const viewerKey = viewer?.viewerUserId
    ? `u:${viewer.viewerUserId}`
    : `ip:${viewer?.viewerIp ?? 'unknown'}`;

  // Dedup key: only count once per window
  const viewKey = `view:book:${slug}:${viewerKey}`;

  const shouldCount = await cacheSetNx(viewKey, '1', BOOK_VIEW_WINDOW);

  if (cached) {
    if (shouldCount) {
      await bookRepo.incrBookViews(cached.id);
      cached.viewsCount = Number(cached.viewsCount ?? 0) + 1;
      await cacheSetJson(cacheKey, cached, BOOK_TTL);
    }
    return cached;
  }

  const book = await bookRepo.findBookBySlugPublic(slug);
  if (!book) throw new NotFoundError('Book not found');

  const tags = await bookRepo.getBookTags(book.id);
  const chapters = await chapterRepo.listChapterHeadersByBook(book.id);

  const hasFreeChapters = chapters.some((c: any) => c.visibility === 'PUBLIC' && c.isPublished === 1);
  const hasMembersOnlyChapters = chapters.some((c: any) => c.visibility !== 'PUBLIC' && c.isPublished === 1);

  const baseViews = Number((book as any).views_count ?? 0);

  if (shouldCount) await bookRepo.incrBookViews(book.id);

  const payload = {
    id: book.id,
    slug: book.slug,
    title: book.title,
    genre: book.genre,
    synopsis: book.synopsis,
    coverUrl: book.cover_image_url,
    visibility: book.visibility,
    viewsCount: shouldCount ? baseViews + 1 : baseViews,
    authorProfile: { id: book.author_id, penName: book.pen_name },
    tags,
    totalChapters: chapters.filter((c: any) => c.isPublished === 1).length,
    hasFreeChapters,
    hasMembersOnlyChapters,
    status: book.status,
  };

  await cacheSetJson(cacheKey, payload, BOOK_TTL);
  return payload;
};

export const listChapterHeaders = async (slug: string, viewerUserId?: number) => {
  const book = await bookRepo.findBookBySlugPublic(slug);
  if (!book) throw new NotFoundError('Book not found');

  const headers = await chapterRepo.listChapterHeadersByBook(book.id);

  // convenience hint: locked for viewer
  let membership: any = null;
  if (viewerUserId) membership = await membershipRepo.getActiveMembership(viewerUserId, book.author_id);

  const tierId = membership?.tier_id;

  const items = [];
  for (const h of headers) {
    let isLocked = false;

    if (h.isPublished !== 1) {
      // Draft/scheduled not available to readers
      isLocked = true;
    } else if (h.visibility === 'PUBLIC') {
      isLocked = false;
    } else if (!viewerUserId || !membership) {
      isLocked = true;
    } else if (h.visibility === 'MEMBERS') {
      isLocked = false;
    } else if (h.visibility === 'TIERS') {
      // Must pass tier access
      isLocked = !(await membershipRepo.canAccessChapterTier(h.id, book.author_id, tierId));
    }

    items.push({ ...h, isLockedForCurrentUser: isLocked });
  }

  return { bookId: book.id, slug, items };
};

export const getChapterContent = async (slug: string, chapterIndex: number, viewerUserId?: number) => {
  if (!Number.isFinite(chapterIndex) || chapterIndex <= 0) throw new BadRequestError('index must be a positive integer');

  const book = await bookRepo.findBookBySlugPublic(slug);
  if (!book) throw new NotFoundError('Book not found');

  const chapter = await chapterRepo.findChapterByBookAndNoPublic(book.id, chapterIndex);
  if (!chapter) throw new NotFoundError('Chapter not found');

  // Only published chapters for Reader endpoints
  if (chapter.is_draft === 1 || !chapter.published_at) {
    throw new NotFoundError('Chapter not available');
  }
  console.log("UserId: " , viewerUserId)
  // membership gating
  if (chapter.visibility !== 'PUBLIC') {
    if (!viewerUserId) throw new AuthFailureError('Login required');

    const membership = await membershipRepo.getActiveMembership(viewerUserId, book.author_id);
    if (!membership) throw new ForbiddenError('Membership required');

    if (chapter.visibility === 'TIERS') {
      const ok = await membershipRepo.canAccessChapterTier(chapter.id, book.author_id, membership.tier_id);
      if (!ok) throw new ForbiddenError('Tier access required');
    }
  }

  // cache chapter (content)
  const cacheKey = `chapter:${chapter.id}`;
  const cached = await cacheGetJson<any>(cacheKey);
  if (cached) {
    // still count views
    await cacheIncr(`views:chapter:${chapter.id}`);
    return cached;
  }

  const payload = {
    id: chapter.id,
    bookId: chapter.book_id,
    index: chapter.chapter_no,
    title: chapter.title,
    contentMarkdown: chapter.content_md,
    visibility: chapter.visibility,
    releaseAt: chapter.published_at,
    isDraft: Boolean(chapter.is_draft),
  };

  await cacheSetJson(cacheKey, payload, CHAPTER_TTL);
  await cacheIncr(`views:chapter:${chapter.id}`);

  return payload;
};

export const authorCreateBook = async (userId: number, body: any) => {
  const author = await authorRepo.findAuthorByUserId(userId);
  if (!author) throw new ForbiddenError("User is not an author");

  const title = String(body.title ?? "").trim();
  const genre = String(body.genre ?? "").trim();
  if (!title) throw new BadRequestError("title is required");
  if (!genre) throw new BadRequestError("genre is required");

  // -----------------------------
  // SLUG: generate + ensure unique
  // -----------------------------
  const makeBaseSlug = (raw: string) => slugify(String(raw ?? "").trim());

  let baseSlug = makeBaseSlug(body.slug ? String(body.slug) : title);
  if (!baseSlug) baseSlug = makeBaseSlug(title); // safety

  let slug = baseSlug;
  let i = 2;

  while (await bookRepo.existsSlug(slug)) {
    slug = `${baseSlug}-${i}`;
    i += 1;
  }

  const synopsis = body.synopsis ? String(body.synopsis) : null;
  const coverImageUrl = body.coverUrl ? String(body.coverUrl) : null;

  const id = await bookRepo.createBook({
    authorId: author.id,
    title,
    genre,
    slug,
    synopsis: synopsis ?? undefined,
    coverImageUrl: coverImageUrl ?? undefined,
    status: body.status ?? "DRAFT",
    visibility: body.visibility ?? "PUBLIC",
  });

  if (Array.isArray(body.tags) && body.tags.length) {
    const tags = await tagRepo.ensureTags(body.tags);
    await bookRepo.setBookTags(id, tags.map((t: any) => t.id));
  }

  // Clear cache for this slug (even though create normally doesn't need it)
  await cacheDel(`book:${slug}`);

  return { id, slug };
};


export const authorUpdateBook = async (userId: number, bookId: number, body: any) => {
  const author = await authorRepo.findAuthorByUserId(userId);
  if (!author) throw new ForbiddenError('User is not an author');

  const book = await bookRepo.findBookByIdForAuthor(bookId, author.id);
  if (!book) throw new NotFoundError('Book not found');

  const patch: any = {};

  if (body.title !== undefined) {
    const t = String(body.title).trim();
    if (!t) throw new BadRequestError('title cannot be empty');
    patch.title = t;
  }

  if (body.genre !== undefined) {
    const g = String(body.genre).trim();
    if (!g) throw new BadRequestError('genre cannot be empty');
    patch.genre = g;
  }
  // if (body.slug !== undefined) patch.slug = String(body.slug).trim();
  if (body.synopsis !== undefined) patch.synopsis = String(body.synopsis);
  if (body.coverUrl !== undefined) patch.cover_image_url = String(body.coverUrl);
  if (body.status !== undefined) patch.status = body.status;
  if (body.visibility !== undefined) patch.visibility = body.visibility;

  await bookRepo.updateBook(bookId, author.id, patch);

  // tags
  if (Array.isArray(body.tags)) {
    const tags = await tagRepo.ensureTags(body.tags);
    await bookRepo.setBookTags(bookId, tags.map((t: any) => t.id));
  }

  // // invalidate caches for old & new slug
  await cacheDel(`book:${book.slug}`);
  // if (patch.slug && patch.slug !== book.slug) await cacheDel(`book:${patch.slug}`);

  return { ok: true };
};

export const authorCreateChapter = async (userId: number, bookId: number, body: any) => {
  const author = await authorRepo.findAuthorByUserId(userId);
  if (!author) throw new ForbiddenError('User is not an author');

  const book = await bookRepo.findBookByIdForAuthor(bookId, author.id);
  if (!book) throw new NotFoundError('Book not found');

  const title = String(body.title ?? '').trim();
  const contentMd = String(body.contentMarkdown ?? body.contentMd ?? '').trim();
  if (!title) throw new BadRequestError('title is required');
  if (!contentMd) throw new BadRequestError('contentMarkdown is required');

  const visibility = (body.visibility ?? 'PUBLIC') as any;
  const isDraft = body.isDraft === undefined ? 1 : (body.isDraft ? 1 : 0);

  const chSlug = body.slug ? String(body.slug).trim() : slugify(title);

  const scheduledAt = body.plannedReleaseAt ? String(body.plannedReleaseAt) : null;
  const publishedAt = isDraft === 0 ? (body.publishedAt ? String(body.publishedAt) : new Date().toISOString().slice(0, 19).replace('T', ' ')) : null;

  const { chapterId, chapterNo } = await chapterRepo.createChapter({
    bookId,
    authorId: author.id,
    title,
    slug: chSlug,
    contentMd,
    visibility,
    isDraft,
    scheduledAt,
    publishedAt,
    wordCount: body.wordCount ?? null,
  });

  // invalidate book cache since totals/locks change
  await cacheDel(`book:${book.slug}`);

  return { chapterId, chapterNo };
};

export const authorUpdateChapter = async (userId: number, bookId: number, chapterId: number, body: any) => {
  const author = await authorRepo.findAuthorByUserId(userId);
  if (!author) throw new ForbiddenError('User is not an author');

  const book = await bookRepo.findBookByIdForAuthor(bookId, author.id);
  if (!book) throw new NotFoundError('Book not found');

  const patch: any = {};
  if (body.title !== undefined) patch.title = String(body.title).trim();
  if (body.slug !== undefined) patch.slug = String(body.slug).trim();
  if (body.contentMd !== undefined) patch.content_md = String(body.contentMd);
  if (body.wordCount !== undefined) patch.word_count = Number(body.wordCount);
  if (body.visibility !== undefined) patch.visibility = body.visibility;
  if (body.isDraft !== undefined) patch.is_draft = body.isDraft ? 1 : 0;
  if (body.scheduledAt !== undefined) patch.scheduled_at = body.scheduledAt ? String(body.scheduledAt) : null;
  if (body.publishedAt !== undefined) patch.published_at = body.publishedAt ? String(body.publishedAt) : null;

  const affected = await chapterRepo.updateChapter(chapterId, author.id, patch);
  if (!affected) throw new NotFoundError('Chapter not found');

  // invalidate caches
  await cacheDel(`book:${book.slug}`);
  await cacheDel(`chapter:${chapterId}`);

  return { ok: true };
};

export const listBooksByAuthorPublic = async (q: {
  authorId: number;
  query?: string;
  page?: any;
  limit?: any;
}) => {
  const page = Math.max(1, Number(q.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(q.limit ?? 20)));

  const { items, total } = await bookRepo.listBooksByAuthorPublic({
    authorId: Number(q.authorId),
    query: q.query,
    page,
    limit,
  });

  return {
    page,
    limit,
    total,
    items: items.map((b: any) => ({
      id: b.id,
      slug: b.slug,
      title: b.title,
      synopsis: b.synopsis,
      coverUrl: b.coverUrl,
      authorName: b.authorName,
      visibility: b.visibility,
      totalChapters: Number(b.totalChapters ?? 0),
      hasMembersOnlyChapters: Number(b.membersOnlyChapters ?? 0) > 0,
    })),
  };
};

export const authorListMyBooks = async (userId: number, q: {
  query?: string;
  status?: any;
  page?: any;
  limit?: any;
}) => {
  const author = await authorRepo.findAuthorByUserId(userId);
  if (!author) throw new ForbiddenError('User is not an author');

  const page = Math.max(1, Number(q.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(q.limit ?? 20)));

  const status = q.status ? String(q.status).toUpperCase() : undefined;

  const { items, total } = await bookRepo.listMyBooksForAuthor({
    authorId: author.id,
    query: q.query,
    status: status as any,
    page,
    limit,
  });

  return {
    page,
    limit,
    total,
    items: items.map((b: any) => ({
      id: b.id,
      slug: b.slug,
      title: b.title,
      synopsis: b.synopsis,
      coverUrl: b.coverUrl,
      visibility: b.visibility,
      status: b.status,
      totalAllChapters: Number(b.totalAllChapters ?? 0),
      totalPublishedChapters: Number(b.totalPublishedChapters ?? 0),
      createdAt: b.created_at,
      updatedAt: b.updated_at,
    })),
  };
};

export const authorGetBookDetail = async (userId: number, bookId: number) => {
  const author = await authorRepo.findAuthorByUserId(userId);
  if (!author) throw new ForbiddenError('User is not an author');

  const book = await bookRepo.findBookByIdForAuthor(bookId, author.id);
  if (!book) throw new NotFoundError('Book not found');

  const tags = await bookRepo.getBookTags(book.id);

  // includes drafts/scheduled
  const chapters = await chapterRepo.listChapterHeadersByBookForAuthor(book.id, author.id);

  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    genre: book.genre,
    synopsis: book.synopsis,
    coverUrl: book.cover_image_url,
    visibility: book.visibility,
    status: book.status,
    createdAt: book.created_at,
    updatedAt: book.updated_at,
    tags,
    chapters: chapters.map((c: any) => ({
      id: c.id,
      index: c.index,
      title: c.title,
      slug: c.slug,
      visibility: c.visibility,
      isDraft: Boolean(c.is_draft),
      scheduledAt: c.scheduled_at,
      publishedAt: c.published_at,
    })),
  };
};

export const authorGetChapterDetail = async (
  userId: number,
  bookId: number,
  chapterId: number,
) => {
  const author = await authorRepo.findAuthorByUserId(userId);
  if (!author) throw new ForbiddenError('User is not an author');

  const book = await bookRepo.findBookByIdForAuthor(bookId, author.id);
  if (!book) throw new NotFoundError('Book not found');

  const chapter = await chapterRepo.findChapterByIdForAuthor(chapterId, author.id);
  if (!chapter || Number(chapter.book_id) !== Number(bookId)) {
    throw new NotFoundError('Chapter not found');
  }

  return {
    id: chapter.id,
    bookId: chapter.book_id,
    index: chapter.chapter_no,
    title: chapter.title,
    slug: chapter.slug,
    contentMarkdown: chapter.content_md,
    wordCount: chapter.word_count,
    visibility: chapter.visibility,
    isDraft: Boolean(chapter.is_draft),
    scheduledAt: chapter.scheduled_at,
    publishedAt: chapter.published_at,
    createdAt: chapter.created_at,
    updatedAt: chapter.updated_at,
  };
};