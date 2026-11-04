import { randomUUID } from 'crypto';
import {getChapterDocument} from '../models/repositories/chapterDocument.repo';
import { savePublication, getChapterImages } from './publishing.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '../core/error.response';
import * as bookRepo from '../models/repositories/book.repo';
import * as chapterRepo from '../models/repositories/chapter.repo';
import * as tagRepo from '../models/repositories/tag.repo';
import * as authorRepo from '../models/repositories/author.repo';
import * as membershipRepo from '../models/repositories/membership.repo';
import {loadEntitlementContext,canReadChapter,assertEntitled} from './entitlement.service';
import { cacheDel, cacheGetJson, cacheIncr, cacheSetJson,cacheSetNx } from '../utils/cache';
import {moderationNotice} from '../models/repositories/moderation.repo';
import {pageQuery} from '../domain/pagination';
import {boundedText,positiveId} from '../domain/validation';

const BOOK_TTL = 60;      // seconds
const CHAPTER_TTL = 60;   // seconds
const BOOK_VIEW_WINDOW = 60 * 30;  // 30 minutes

const slugify = (s: string) =>
  s.toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const listBooksPublic = async (q: Record<string,unknown>) => {
  const {page,limit,query}=pageQuery(q),genre=boundedText(q.genre??'','Genre filter',255,false),tag=boundedText(q.tag??'','Tag filter',100,false);
  const sort=q.sort??'recent';if(sort!=='recent'&&sort!=='popular'&&sort!=='updated')throw new BadRequestError('Invalid story ordering');

  const { items, total } = await bookRepo.listBooksPublic({ query, page, limit,genre,tag,sort });

  return {
    page,
    limit,
    total,
    items: items.map((b: any) => ({
      id: b.id,
      slug: b.slug,
      title: b.title,
      genre:b.genre,authorId:b.authorId,visibility:b.visibility,
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
  // Availability is fresh even when descriptive metadata was previously cached.
  const book = await bookRepo.findBookBySlugPublic(slug);
  if (!book) throw new NotFoundError('Book not found');

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

  const tags = await bookRepo.getBookTags(book.id);
  const chapters = await chapterRepo.listChapterHeadersByBook(book.id);

  const hasFreeChapters = book.visibility==='PUBLIC'&&chapters.some((c: any) => c.visibility === 'PUBLIC' && c.isPublished === 1);
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

  const [context,bookRules,chapterRules]=await Promise.all([
    loadEntitlementContext(viewerUserId,Number(book.author_id)),
    membershipRepo.getTierRules('book',book.id,book.author_id),
    membershipRepo.getChapterTierRules(book.id,book.author_id),
  ]);
  const items=headers.map(h=>({
    ...h,
    isLockedForCurrentUser:!canReadChapter(context,
      {visibility:book.visibility,rules:bookRules},
      {released:Number(h.isPublished)===1,visibility:h.visibility,rules:chapterRules.get(Number(h.id))??[]},
    ).allowed,
  }));

  return { bookId: book.id, slug, items };
};

export const getChapterContent = async (slug: string, chapterIndex: number, viewerUserId?: number) => {
  if (!Number.isSafeInteger(chapterIndex) || chapterIndex <= 0) throw new BadRequestError('index must be a positive integer');

  const book = await bookRepo.findBookBySlugPublic(slug);
  if (!book) throw new NotFoundError('Book not found');

  const chapter = await chapterRepo.findChapterByBookAndNoPublic(book.id, chapterIndex);
  if (!chapter) throw new NotFoundError('Chapter not found');

  // Only published chapters for Reader endpoints
  if (chapter.is_draft === 1 || !chapter.published_at || !chapter.release_ready) {
    throw new NotFoundError('Chapter not available');
  }
  const [context,bookRules,chapterRules]=await Promise.all([
    loadEntitlementContext(viewerUserId,Number(book.author_id)),
    membershipRepo.getTierRules('book',book.id,book.author_id),
    membershipRepo.getTierRules('chapter',chapter.id,book.author_id),
  ]);
  assertEntitled(canReadChapter(context,
    {visibility:book.visibility,rules:bookRules},
    {released:Boolean(chapter.release_ready)&&chapter.is_draft===0,visibility:chapter.visibility,rules:chapterRules},
  ));

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
    contentDocument: await getChapterDocument(chapter.id),
    images: await getChapterImages(chapter.id),
    visibility: chapter.visibility,
    releaseAt: chapter.published_at,
    isDraft: Boolean(chapter.is_draft),
  };

  await cacheSetJson(cacheKey, payload, CHAPTER_TTL);
  await cacheIncr(`views:chapter:${chapter.id}`);

  return payload;
};

// Legacy callers may omit requestId; the new editor always supplies a stable save ID.
export const authorCreateBook = (userId: number, body: any) =>
  savePublication(userId, { ...body, requestId: body.requestId ?? randomUUID() }, 'book');
export const authorUpdateBook = (userId: number, bookId: number, body: any) =>
  savePublication(userId, { ...body, requestId: body.requestId ?? randomUUID() }, 'book', bookId);
export const authorCreateChapter = (userId: number, bookId: number, body: any) =>
  savePublication(userId, { ...body, requestId: body.requestId ?? randomUUID() }, 'chapter', bookId);
export const authorUpdateChapter = (userId: number, bookId: number, chapterId: number, body: any) =>
  savePublication(userId, { ...body, requestId: body.requestId ?? randomUUID() }, 'chapter', bookId, chapterId);

export const listBooksByAuthorPublic = async (q: {
  authorId: number;
  query?: string;
  page?: any;
  limit?: any;
}) => {
  const {page,limit,query}=pageQuery(q);

  const { items, total } = await bookRepo.listBooksByAuthorPublic({
    authorId: positiveId(q.authorId,'author'),
    query,
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
      genre:b.genre,authorId:b.authorId,viewsCount:Number(b.viewsCount??0),
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
    ...await moderationNotice('BOOK',book.id),
    id: book.id,
    slug: book.slug,
    title: book.title,
    genre: book.genre,
    synopsis: book.synopsis,
    coverUrl: book.cover_image_url,
    visibility: book.visibility,
    status: book.status,
    requiredTierIds:(await membershipRepo.getTierRules('book',book.id,author.id)).map(t=>t.tierId),
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
    ...await moderationNotice('CHAPTER',chapter.id),
    id: chapter.id,
    bookId: chapter.book_id,
    index: chapter.chapter_no,
    title: chapter.title,
    slug: chapter.slug,
    contentMarkdown: chapter.content_md,
    contentDocument: await getChapterDocument(chapter.id),
    images: await getChapterImages(chapter.id),
    wordCount: chapter.word_count,
    visibility: chapter.visibility,
    isDraft: Boolean(chapter.is_draft),
    requiredTierIds:(await membershipRepo.getTierRules('chapter',chapter.id,author.id)).map(t=>t.tierId),
    scheduledAt: chapter.scheduled_at,
    publishedAt: chapter.published_at,
    createdAt: chapter.created_at,
    updatedAt: chapter.updated_at,
  };
};
