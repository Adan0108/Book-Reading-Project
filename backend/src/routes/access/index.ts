import { Router } from "express";
import asyncHandler from "../../helpers/asyncHandler";
import accessController from "../../controllers/access.controller";
import { authenticationV2, requireRefreshToken } from "../../auth/checkAuth";

const router = Router();

// =========================================================================
// PUBLIC ROUTES
// =========================================================================

// router.post("/register",asyncHandler(accessController.register));

/**
 * @openapi
 * /v1/api/access/register-email:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Step 1 - Register via Email
 *     description: Creates an inactive user and sends an OTP to the email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: testuser@example.com
 *     responses:
 *       200:
 *         description: Verification code sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Verification code sent.
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     cooldown:
 *                       type: integer
 *                       example: 60
 *       400:
 *         description: Missing email or cooldown active
 *       409:
 *         description: Email already registered
 */
router.post("/register-email", asyncHandler(accessController.registerEmail));

/**
 * @openapi
 * /v1/api/access/verify-email:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Step 2 - Verify Email OTP
 *     description: Verifies the OTP sent to the user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: testuser@example.com
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid OTP or User not found
 *       401:
 *         description: Too many failed attempts
 */
router.post("/verify-email", asyncHandler(accessController.verifyEmail));

/**
 * @openapi
 * /v1/api/access/setup-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Step 3 - Setup Password & Profile
 *     description: Finalizes registration by setting password and username.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - username
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "StrongPass123!"
 *               username:
 *                 type: string
 *                 example: "bookworm99"
 *     responses:
 *       201:
 *         description: Account created successfully
 *       400:
 *         description: Missing fields
 */
router.post("/setup-password", asyncHandler(accessController.setupPassword));

/**
 * @openapi
 * /v1/api/access/resend-otp:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Resend Registration OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       400:
 *         description: Cooldown active
 */
router.post("/resend-otp", asyncHandler(accessController.resendOtp));

/**
 * @openapi
 * /v1/api/access/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: User Login
 *     description: Authenticates user and returns Access Token + Sets Refresh Cookie.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: testuser@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "StrongPass123!"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: LoginOK
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         email:
 *                           type: string
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *       400:
 *         description: Missing credentials
 *       401:
 *         description: Invalid credentials or Account not active
 */
router.post("/login", asyncHandler(accessController.login));

/**
 * @openapi
 * /v1/api/access/forgot-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Request Password Reset OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset code sent
 *       400:
 *         description: Email not found or inactive
 */
router.post("/forgot-password", asyncHandler(accessController.forgotPassword));

/**
 * @openapi
 * /v1/api/access/reset-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Reset Password with OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       401:
 *         description: Invalid OTP
 */
router.post("/reset-password", asyncHandler(accessController.resetPassword));


// =========================================================================
// PROTECTED ROUTES
// =========================================================================

/**
 * @openapi
 * /v1/api/access/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Logout (Protected)
 *     security:
 *       - bearerAuth: []
 *       - clientId: []
 *     parameters:
 *       - in: header
 *         name: x-client-id
 *         schema:
 *           type: integer
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized (Invalid Token/Client ID)
 */
router.post("/logout", authenticationV2, asyncHandler(accessController.logout));

/**
 * @openapi
 * /v1/api/access/refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Refresh Tokens
 *     description: Uses Refresh Token cookie to issue new pair.
 *     security:
 *       - clientId: []
 *     parameters:
 *       - in: header
 *         name: x-client-id
 *         schema:
 *           type: integer
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 *       401:
 *         description: Invalid Refresh Token or Client ID
 *       404:
 *         description: Key pair not found
 */
router.post("/refresh", requireRefreshToken, asyncHandler(accessController.refresh));

export default router;
