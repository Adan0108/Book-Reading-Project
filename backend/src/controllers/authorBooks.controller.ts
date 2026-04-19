import type { Request, Response } from 'express';
import { SuccessResponse } from '../core/success.response';
import * as bookService from '../services/book.service';

export const createBook = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const uid = Number(user?.uid ?? user?.userId);

  const data = await bookService.authorCreateBook(uid, req.body);
  new SuccessResponse({ message: 'Created', metadata: data }).send(res);
};

export const updateBook = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const uid = Number(user?.uid ?? user?.userId);

  const bookId = Number(req.params.bookId);
  const data = await bookService.authorUpdateBook(uid, bookId, req.body);

  new SuccessResponse({ message: 'Updated', metadata: data }).send(res);
};

export const createChapter = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const uid = Number(user?.uid ?? user?.userId);

  const bookId = Number(req.params.bookId);
  const data = await bookService.authorCreateChapter(uid, bookId, req.body);

  new SuccessResponse({ message: 'Created', metadata: data }).send(res);
};

export const updateChapter = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const uid = Number(user?.uid ?? user?.userId);

  const bookId = Number(req.params.bookId);
  const chapterId = Number(req.params.chapterId);

  const data = await bookService.authorUpdateChapter(uid, bookId, chapterId, req.body);

  new SuccessResponse({ message: 'Updated', metadata: data }).send(res);
};

export const listMyBooks = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userId = Number(user?.uid ?? user?.userId);

  const data = await bookService.authorListMyBooks(userId, {
    query: req.query.query as any,
    status: req.query.status as any, // DRAFT|PUBLISHED|HIDDEN
    page: req.query.page as any,
    limit: req.query.limit as any,
  });

  new SuccessResponse({ message: 'OK', metadata: data }).send(res);
};

export const getMyBookDetail = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userId = Number(user?.uid ?? user?.userId);

  const bookId = Number(req.params.bookId);
  const data = await bookService.authorGetBookDetail(userId, bookId);

  new SuccessResponse({ message: 'OK', metadata: data }).send(res);
};

export const getMyChapterDetail = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userId = Number(user?.uid ?? user?.userId);

  const bookId = Number(req.params.bookId);
  const chapterId = Number(req.params.chapterId);

  const data = await bookService.authorGetChapterDetail(userId, bookId, chapterId);
  new SuccessResponse({ message: 'OK', metadata: data }).send(res);
};

