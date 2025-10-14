
import express from 'express';
import * as accessController from '../../controllers/access.controller';
import { asyncHandler } from '../../helpers/asyncHandler'; // A wrapper to handle async errors

import { authenticateToken } from '../../auth/checkAuth';

const router = express.Router();

router.post('/register', asyncHandler(accessController.register));
router.post('/verify-registration', asyncHandler(accessController.verifyRegistration));

router.post('/login', asyncHandler(accessController.login));

// Note: Logout needs an authentication middleware to run first
router.post('/logout', authenticateToken, asyncHandler(accessController.logout));

// This route does not require the accessToken middleware
router.post('/refresh', asyncHandler(accessController.handleRefreshToken));

router.post('/forgot-password', asyncHandler(accessController.forgotPassword));
router.post('/reset-password', asyncHandler(accessController.resetPassword));

export default router;