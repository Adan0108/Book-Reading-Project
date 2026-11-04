import { authRateLimit } from '../../auth/rateLimit';
import { trustedAuthOrigin } from '../../auth/trustedOrigin';
import { Router } from "express";
import asyncHandler from "../../helpers/asyncHandler";
import accessController from "../../controllers/access.controller";
import { authenticationV2, requireRefreshToken, requireAccessCookie } from "../../auth/checkAuth";

const router = Router();
router.use(trustedAuthOrigin);
router.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});

// =========================================================================
// PUBLIC ROUTES
// =========================================================================

// router.post("/register",asyncHandler(accessController.register));

router.post("/register-email", authRateLimit(5), asyncHandler(accessController.registerEmail));
router.post("/verify-email", authRateLimit(20), asyncHandler(accessController.verifyEmail));
router.post("/setup-password", authRateLimit(10), asyncHandler(accessController.setupPassword));
router.post("/resend-otp", authRateLimit(5), asyncHandler(accessController.resendOtp));
router.post("/login", authRateLimit(20), authRateLimit(10,60,true), asyncHandler(accessController.login));
router.post("/forgot-password", authRateLimit(5), asyncHandler(accessController.forgotPassword));
router.post("/reset-password", authRateLimit(20), asyncHandler(accessController.resetPassword));


// =========================================================================
// PROTECTED ROUTES
// =========================================================================

router.post("/logout", authenticationV2, asyncHandler(accessController.logout));
router.post('/logout-all', authenticationV2, asyncHandler(accessController.logoutAll));
router.post("/refresh", requireRefreshToken, asyncHandler(accessController.refresh));
router.post('/session', requireAccessCookie, asyncHandler(accessController.session));

export default router;
