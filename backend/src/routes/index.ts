import { Router } from "express";
import accessRouter from "./access";
import userRouter from "./user";
import booksRouter from './books';
import authorMeBooksRouter from './authors/me/books';

const router = Router();

router.use("/v1/api/access", accessRouter);

router.use("/v1/api/user", userRouter);

router.use('/v1/api/books', booksRouter);

router.use('/v1/api/authors/me/books', authorMeBooksRouter);

export default router;
