import { Router } from "express";
import asyncHandler from "../../helpers/asyncHandler";
import accessController from "../../controllers/access.controller";
import { authenticationV2, requireRefreshToken } from "../../auth/checkAuth";

const router = Router();

// public
// router.post("/register",asyncHandler(accessController.register));
router.post("/register-email", asyncHandler(accessController.registerEmail));
router.post("/verify-email", asyncHandler(accessController.verifyEmail));
router.post("/setup-password", asyncHandler(accessController.setupPassword));
router.post("/resend-otp", asyncHandler(accessController.resendOtp));
router.post("/login",asyncHandler(accessController.login));

//protected
router.post("/logout", authenticationV2, asyncHandler(accessController.logout));
router.post("/refresh",  requireRefreshToken, asyncHandler(accessController.refresh));

export default router;
