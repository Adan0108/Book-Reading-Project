import { Router } from 'express';
import * as authorBooksController from '../../../controllers/authorBooks.controller';
import { authenticationV2 } from '../../../auth/checkAuth';
import { requireRoles } from '../../../auth/requireRoles';
import asyncHandler from '../../../helpers/asyncHandler';

const router = Router();

router.use(authenticationV2);
router.use(requireRoles(['AUTHOR', 'ADMIN']));

router.post('/', asyncHandler(authorBooksController.createBook));
router.patch('/:bookId', asyncHandler(authorBooksController.updateBook));

router.post('/:bookId/chapters', asyncHandler(authorBooksController.createChapter));
router.patch('/:bookId/chapters/:chapterId', asyncHandler(authorBooksController.updateChapter));
router.get('/', asyncHandler(authorBooksController.listMyBooks));

export default router;
