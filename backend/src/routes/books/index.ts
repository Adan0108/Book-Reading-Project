import { Router } from 'express';
import * as bookController from '../../controllers/book.controller';
import asyncHandler from '../../helpers/asyncHandler';
import { optionalAuthenticationV2 } from '../../auth/optionalAuth';

const router = Router();

// Public list
router.get('/', asyncHandler(bookController.listBooks));

// Book detail
router.get('/:slug', asyncHandler(bookController.getBookBySlug));

// TOC headers 
router.get('/:slug/chapters', asyncHandler(bookController.listBookChapters));

// Chapter content 
router.get('/:slug/chapters/:index', optionalAuthenticationV2 ,asyncHandler(bookController.getChapterByIndex));

// Public list by author
router.get('/:authorId/books', asyncHandler(bookController.listBooksByAuthor));

export default router;
