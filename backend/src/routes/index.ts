import { Router } from "express";
import accessRouter from "./access";
import userRouter from "./user";
import booksRouter from './books';
import authorMeBooksRouter from './authors/me/books';
import authorApplicationsRouter from "./authorApplications";
import adminAuthorApplicationsRouter from "./admin/authorApplications";

const router = Router();

router.use("/v1/api/access", accessRouter);

router.use("/v1/api/user", userRouter);

router.use('/v1/api/books', booksRouter);

router.use('/v1/api/authors/me/books', authorMeBooksRouter);

router.use("/v1/api/author-applications", authorApplicationsRouter);
router.use("/v1/api/admin/author-applications", adminAuthorApplicationsRouter);

export default router;
