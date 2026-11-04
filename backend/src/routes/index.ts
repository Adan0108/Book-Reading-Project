import { Router } from "express";
import accessRouter from "./access";
import userRouter from "./user";
import booksRouter from './books';
import authorMeBooksRouter from './authors/me/books';
import authorApplicationsRouter from "./authorApplications";
import adminAuthorApplicationsRouter from "./admin/authorApplications";
import uploadRouter from "./upload";
import membershipsRouter from './memberships';
import chatRouter from './chat';
import adminModerationRouter from './adminModeration';
import readerRouter from './reader';

const router = Router();
// Authorizations are reevaluated per request; shared HTTP caches must not replay member content.
router.use('/v1/api',(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});

router.use("/v1/api/access", accessRouter);

router.use("/v1/api/user", userRouter);

router.use('/v1/api/books', booksRouter);

router.use('/v1/api/authors/me/books', authorMeBooksRouter);

router.use("/v1/api/author-applications", authorApplicationsRouter);
router.use("/v1/api/admin/author-applications", adminAuthorApplicationsRouter);

router.use("/v1/api", uploadRouter);
router.use('/v1/api',membershipsRouter);
router.use('/v1/api',chatRouter);
router.use('/v1/api',adminModerationRouter);
router.use('/v1/api',readerRouter);

export default router;
