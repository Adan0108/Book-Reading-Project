import bcrypt from "bcrypt";
import crypto from "node:crypto";
import * as UserRepo from "../models/repositories/user.repo";
import * as ProfileRepo from "../models/repositories/userProfile.repo";
import * as KeysRepo from "../models/repositories/userKeys.repo";
import type { UserKeysRow } from "../models/repositories/userKeys.repo";
import type { User } from "../models/user.model";
import {
  AuthFailureError,
  BadRequestError,
  ConflictRequestError,
} from "../core/error.response";
import { createTokenPair, revokeToken } from "../auth/checkAuth";
import * as OtpService from "./otp.service";
import { getRedis } from "../dbs/init.redis";
import { RedisErrorResponse } from "../core/error.response";

/** Register:
 * - create user
 * - create profile (username = user<id>)
 * - assign READER role
 * - generate per-user key pair
 * - return tokens
// export async function register(email: string, password: string): Promise<{
//   user: Pick<User, "id" | "email">;
//   tokens: { accessToken: string; refreshToken: string };
// }> {
//   const existing = await findByEmail(email);
//   if (existing) throw new BadRequestError("Email already registered");

//   const hash = await bcrypt.hash(password, 12);
//   const user = await createUser(email, hash);
//   const id = Number(user.id);

//   // profile
//   await createProfile(id, `user${id}`);

//   // role
//   await addRole(id, "READER");

//   // key pair (hex strings; consider KMS later)
//   const publicKey = crypto.randomBytes(64).toString("hex");
//   const privateKey = crypto.randomBytes(64).toString("hex");
//   await upsertKeys(id, publicKey, privateKey);

//   const tokens = await createTokenPair({ uid: id, email }, publicKey, privateKey);
//   return { user: { id, email: user.email }, tokens };
// }
 */

/**
 * Step 1: Submit email, create inactive user, send OTP.
 */
export async function registerEmail(email: string) {
  let user = await UserRepo.findByEmail(email);

  const redisClient = getRedis();
  if (!redisClient) throw new RedisErrorResponse("Redis not ready");

  // 1. Check if user already exists
  if (user) {
    if (user.state === 1) {
      // state 1 = ACTIVE
      throw new ConflictRequestError("Email already registered");
    }
    // If user is state 0 (inactive) or 2 (pending password), we can proceed.
  }

  // 2. If user doesn't exist, create them in an inactive state
  if (!user) {
    user = await UserRepo.createInactiveUser(email);
  }

  // 3. Check for OTP cooldown
  const remainingCooldown = await OtpService.checkOtpCooldown(user.id);
  if (remainingCooldown > 0) {
    throw new BadRequestError(
      `Please wait ${remainingCooldown} seconds to resend OTP.`
    );
  }

  // 4. Generate, save, and send new OTP
  const { otp, otpHash } = await OtpService.generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  await UserRepo.createVerification(user.id, "EMAIL_OTP", otpHash, expiresAt);
  await OtpService.sendOtpEmail(email, otp);

  // Reset the failed attempts counter
  await OtpService.clearOtpAttempts(user.id, "EMAIL_OTP");

  return {
    message: "Verification code sent to your email.",
    cooldown: OtpService.OTP_COOLDOWN_MINUTES * 60,
  };
}

/**
 * Step 2: Verify email with OTP.
 */
export async function verifyEmail(email: string, otp: string) {
  const user = await UserRepo.findByEmail(email);
  if (!user || user.state !== 0) {
    throw new BadRequestError("User not found or has already been verified.");
  }

  // 1. Check if user is already blocked (too many attempts)
  await OtpService.checkOtpAttempts(user.id, "EMAIL_OTP"); // <- moved to otp.service.ts

  // 2. Find the active OTP
  const verification = await UserRepo.findActiveOtpByType(user.id, "EMAIL_OTP");
  if (!verification) {
    throw new BadRequestError("No active OTP found. Please request a new one.");
  }

  // 3. Check if OTP matches
  const isMatch = await bcrypt.compare(otp, verification.otp_hash!);
  if (!isMatch) {
    // 4. If no match, increment counter (this function will throw an error)
    await OtpService.incrementOtpAttempts(user.id, "EMAIL_OTP", verification); // <- moved to otp.service.ts
  }

  // 5. Success: Mark OTP as used and update user state
  await OtpService.clearOtpAttempts(user.id, "EMAIL_OTP"); // clear the counter // <- moved to otp.service.ts
  await UserRepo.markVerificationAsVerified(verification.id);
  await UserRepo.updateState(user.id, 2); // 2 = VERIFIED_PENDING_PASSWORD

  return {
    message: "Email verified. You may now set your password.",
  };
}

/**
 * Step 3: Set password, username, and activate account.
 */
export async function setupPassword(
  email: string,
  password: string,
  username: string
) {
  const user = await UserRepo.findByEmail(email);
  if (!user || user.state !== 2) {
    // 2 = VERIFIED_PENDING_PASSWORD
    throw new BadRequestError("User not found or email not verified.");
  }

  const userId = user.id;

  // 1. Set password and activate account
  const passwordHash = await bcrypt.hash(password, 12);
  await UserRepo.updatePassword(userId, passwordHash);
  await UserRepo.updateState(userId, 1); // 1 = ACTIVE

  // 2. Create profile
  await ProfileRepo.createProfile(userId, username);

  // 3. Assign role
  await UserRepo.addRole(userId, "READER");

  // 4. Create user key pair
  const publicKey = crypto.randomBytes(64).toString("hex");
  const privateKey = crypto.randomBytes(64).toString("hex");
  await KeysRepo.upsert(userId, publicKey, privateKey);

  return {
    message: "Account setup complete. You can now log in.",
    user: {
      id: userId,
      email: user.email,
      username: username,
    },
  };
}

/**
 * Resend OTP
 */
export async function resendOtp(email: string) {
  const user = await UserRepo.findByEmail(email);
  if (!user || user.state === 1) {
    throw new BadRequestError("Invalid user or account is already active.");
  }

  const redisClient = getRedis();
  if (!redisClient) throw new RedisErrorResponse("Redis not ready");

  // 1. Check for cooldown
  const remainingCooldown = await OtpService.checkOtpCooldown(user.id);
  if (remainingCooldown > 0) {
    throw new BadRequestError(
      `Please wait ${remainingCooldown} seconds to resend OTP.`
    );
  }

  // 2. Invalidate old OTPs
  await OtpService.clearOtpAttempts(user.id, "EMAIL_OTP"); // <- moved to otp.service.ts

  // 3. Generate, save, and send new OTP
  const { otp, otpHash } = await OtpService.generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  await UserRepo.createVerification(user.id, "EMAIL_OTP", otpHash, expiresAt);
  await OtpService.sendOtpEmail(email, otp);

  // Reset the failed attempts counter
  await OtpService.clearOtpAttempts(user.id, "EMAIL_OTP"); // <- moved to otp.service.ts

  return {
    message: "Verification code resent to your email.",
    cooldown: OtpService.OTP_COOLDOWN_MINUTES * 60,
  };
}

/**
 * Forgot Password: Request a reset OTP.
 */
export async function forgotPassword(email: string) {
  // 1. Find user, but ONLY if they are active
  const user = await UserRepo.findByEmail(email);
  if (!user || user.state !== 1) { // 1 = ACTIVE
    throw new BadRequestError("No active account found for this email.");
  }

  // 2. Check for OTP cooldown (using 'RESET' type)
  const remainingCooldown = await OtpService.checkOtpCooldown(user.id); // Note: Cooldown is shared for now.
  if (remainingCooldown > 0) {
    throw new BadRequestError(`Please wait ${remainingCooldown} seconds to request a new code.`);
  }

  // 3. Invalidate old 'RESET' OTPs
  await UserRepo.invalidateActiveOtps(user.id, "RESET");

  // 4. Generate, save, and send new 'RESET' OTP
  const { otp, otpHash } = await OtpService.generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  await UserRepo.createVerification(user.id, "RESET", otpHash, expiresAt);
  
  // Use the new email function
  await OtpService.sendResetPasswordOtpEmail(email, otp);

  // 5. Reset the attempt counter for 'RESET'
  await OtpService.clearOtpAttempts(user.id, "RESET");

  return {
    message: "Password reset code sent to your email.",
    cooldown: OtpService.OTP_COOLDOWN_MINUTES * 60,
  };
}

/**
 * Verify OTP and set new password.
 */
export async function resetPassword(email: string, otp: string, newPassword: string) {
  // 1. Find active user
  const user = await UserRepo.findByEmail(email);
  if (!user || user.state !== 1) {
    throw new BadRequestError("No active account found for this email.");
  }

  // 2. Check brute-force attempts
  await OtpService.checkOtpAttempts(user.id, "RESET");

  // 3. Find the active 'RESET' OTP
  const verification = await UserRepo.findActiveOtpByType(user.id, "RESET");
  if (!verification) {
    throw new BadRequestError("No active password reset request found. Please try again.");
  }

  // 4. Check if OTP matches
  const isMatch = await bcrypt.compare(otp, verification.otp_hash!);
  if (!isMatch) {
    // 5. If no match, increment counter
    await OtpService.incrementOtpAttempts(user.id, "RESET", verification);
  }

  // 6. Success: Clear counter, hash new password, and update user
  await OtpService.clearOtpAttempts(user.id, "RESET");
  await UserRepo.markVerificationAsVerified(verification.id);
  
  const newPasswordHash = await bcrypt.hash(newPassword, 12);
  await UserRepo.updatePassword(user.id, newPasswordHash);

  // 7. Security: Invalidate all existing tokens
  const redisClient = getRedis();
  if (!redisClient) throw new RedisErrorResponse("Redis not ready");
  // This key is used by checkAuth.ts to log out all other sessions
  const cutoffKey = `TOKEN_IAT_AVAILABLE_${user.id}`; 
  const cutoffTimestamp = Math.floor(Date.now() / 1000);
  await redisClient.set(cutoffKey, cutoffTimestamp.toString());

  return {
    message: "Password has been reset successfully. You can now log in.",
  };
}

/** Login:
 * - verify credentials
 * - ensure per-user key pair exists (create if missing)
 * - issue tokens
 */
export async function login(
  email: string,
  password: string
): Promise<{
  user: Pick<User, "id" | "email">;
  tokens: { accessToken: string; refreshToken: string };
}> {
  const user = await UserRepo.findByEmail(email);
  if (!user) throw new AuthFailureError("Invalid credentials");
  if (!(await bcrypt.compare(password, user.password_hash)))
    throw new AuthFailureError("Invalid credentials");
  if (user.state === 0) throw new AuthFailureError("Account blocked");
  if (user.state === 2)
    throw new AuthFailureError(
      "Account not fully set up. Please set your password."
    );
  if (user.state !== 1) throw new AuthFailureError("Account is not active.");

  const id = Number(user.id);

  let keys: UserKeysRow; // <-- non-nullable
  const existing = await KeysRepo.getByUserId(id);
  if (existing) {
    keys = existing;
  } else {
    const publicKey = crypto.randomBytes(64).toString("hex");
    const privateKey = crypto.randomBytes(64).toString("hex");
    await KeysRepo.upsert(id, publicKey, privateKey);
    keys = {
      user_id: id,
      public_key: publicKey,
      private_key: privateKey,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  const tokens = await createTokenPair(
    { uid: id, email },
    keys.public_key,
    keys.private_key
  );
  return { user: { id, email: user.email }, tokens };
}

/** Logout:
 * - blacklist the current access token (middleware put decoded token into req.user)
 */
export async function logout(decodedAT: {
  uid: number;
  jti: string;
  exp?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = decodedAT.exp ? Math.max(decodedAT.exp - now, 1) : 24 * 60 * 60;
  await revokeToken(decodedAT.uid, decodedAT.jti, ttl);
  return { ok: true };
}

/** refresh (requires RT middleware) */
export async function refreshTokens(
  userId: number,
  email: string,
  currentRtJti: string,
  rtExp?: number
) {
  const keys = await KeysRepo.getByUserId(userId);
  if (!keys) throw new AuthFailureError("Key pair missing");

  // rotate refresh token: invalidate the current RT to prevent reuse
  if (currentRtJti) {
    const now = Math.floor(Date.now() / 1000);
    const ttl = rtExp ? Math.max(rtExp - now, 1) : 7 * 24 * 60 * 60;
    await revokeToken(userId, currentRtJti, ttl);
  }

  // mint a fresh pair (same per-user keys)
  return await createTokenPair(
    { uid: userId, email },
    keys.public_key,
    keys.private_key
  );
}
