import type { Request, Response } from 'express';
import { SuccessResponse } from '../core/success.response';
import * as bookService from '../services/book.service';

export const listBooks = async (req: Request, res: Response) => {
  const data = await bookService.listBooksPublic({
    query: req.query.query as any,
    page: req.query.page as any,
    limit: req.query.limit as any,
  });

  new SuccessResponse({ message: 'OK', metadata: data }).send(res);
};

export const getBookBySlug = async (req: Request, res: Response) => {
  const data = await bookService.getBookDetailBySlug(req.params.slug);
  new SuccessResponse({ message: 'OK', metadata: data }).send(res);
};

export const listBookChapters = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const viewerId = user?.uid ?? user?.userId ?? undefined;

  const data = await bookService.listChapterHeaders(req.params.slug, viewerId ? Number(viewerId) : undefined);
  new SuccessResponse({ message: 'OK', metadata: data }).send(res);
};

export const getChapterByIndex = async (req: Request, res: Response) => {
  const user = (req as any).user;
  console.log('User info:', user);
  const viewerId = user?.uid ?? user?.userId ?? undefined;

  const slug = req.params.slug;
  const idx = Number(req.params.index);

  const data = await bookService.getChapterContent(slug, idx, viewerId ? Number(viewerId) : undefined);
  new SuccessResponse({ message: 'OK', metadata: data }).send(res);
};
