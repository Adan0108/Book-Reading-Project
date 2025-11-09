import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { getRemainingCooldown, createVerification, findActiveOtpByType, invalidateActiveOtps } from '../models/repositories/user.repo';
import type { VerificationType } from '../models/userVerification.model';
import sendMail from '../utils/sendMail';
import { getRedis } from '../dbs/init.redis';
import { RedisErrorResponse, AuthFailureError } from '../core/error.response';

export const OTP_COOLDOWN_MINUTES = 1;
export const MAX_OTP_ATTEMPTS = 10;
const getOtpAttemptsKey = (userId: number, type: VerificationType) => `otp_attempts:${userId}:${type}`;

/**
 * Generates a 6-digit OTP and its hash.
 */
export const generateOtp = async () => {
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  return { otp, otpHash };
};

/**
 * Checks if a user has requested an OTP within the cooldown period.
 */
export const checkOtpCooldown = async (userId: number, type: VerificationType): Promise<number> => {
  return await getRemainingCooldown(
    userId,
    type,
    OTP_COOLDOWN_MINUTES
  );
};

/**
 * Checks if a user has exceeded the max attempt limit.
 */
export const checkOtpAttempts = async (userId: number, type: VerificationType) => {
  const redisClient = getRedis();
  if (!redisClient) throw new RedisErrorResponse("Redis not ready");

  const attemptsKey = getOtpAttemptsKey(userId, type);
  const attempts = Number(await redisClient.get(attemptsKey)) || 0;

  if (attempts >= MAX_OTP_ATTEMPTS) {
    throw new AuthFailureError("Too many failed OTP attempts. Please request a new code.");
  }
};

/**
 * Increments the failed attempt counter for a user.
 */
export const incrementOtpAttempts = async (userId: number, type: VerificationType, verification: any) => {
  const redisClient = getRedis();
  if (!redisClient) throw new RedisErrorResponse("Redis not ready");

  const attemptsKey = getOtpAttemptsKey(userId, type);
  const newAttempts = await redisClient.incr(attemptsKey);

  if (newAttempts === 1) {
    // On the first failed attempt, set the counter to expire when the OTP expires
    const otpExpiry = new Date(verification.expires_at).getTime();
    const now = Date.now();
    const ttl = Math.floor((otpExpiry - now) / 1000);
    if (ttl > 0) {
      await redisClient.expire(attemptsKey, ttl);
    }
  }

  // If this was the 10th attempt, invalidate the OTP
  if (newAttempts >= MAX_OTP_ATTEMPTS) {
    await invalidateActiveOtps(userId, type);
    await redisClient.del(attemptsKey); // clean up
    throw new AuthFailureError("Invalid OTP. Too many failed attempts. A new code is required.");
  }
  
  // Throw the standard error
  throw new AuthFailureError(`Invalid OTP. You have ${MAX_OTP_ATTEMPTS - newAttempts} attempts remaining.`);
};

/**
 * Clears the attempt counter for a user (e.g., on success or new OTP).
 */
export const clearOtpAttempts = async (userId: number, type: VerificationType) => {
  const redisClient = getRedis();
  if (!redisClient) throw new RedisErrorResponse("Redis not ready");

  const attemptsKey = getOtpAttemptsKey(userId, type);
  await redisClient.del(attemptsKey);
};

// /**
//  * Mocks sending an OTP to the user's email.
//  */
// export const sendOtpEmail = async (email: string, otp: string) => {
//   console.log(`
//     ================================================
//     Mock Email Sent to: ${email}
//     Your account verification OTP is: ${otp}
//     (This OTP will expire in 5 minutes)
//     ================================================
//   `);
//   return true;
// };

/**
 * Sending a REGISTRATION OTP to the user's email.
 */
export const sendOtpEmail = async (email: string, otp: string) => {
  try {
    await sendMail({
      email: email,
      subject: 'Your Verification Code - Book Project',
      template: 'otp-mail.ejs',
      data: {
        email: email, 
        otp: otp      
      }
    });
    return true;
  } catch (error) {
    console.error(`[OTP Service] Failed to send email via sendMail service:`, error);
    throw new Error('Failed to send verification email.');
  }
};

/**
 * Sending a PASSWORD RESET OTP to the user's email.
 */
export const sendResetPasswordOtpEmail = async (email: string, otp: string) => {
  try {
    await sendMail({
      email: email,
      subject: 'Your Password Reset Code - Book Project',
      template: 'reset-password-mail.ejs',
      data: {
        email: email, 
        otp: otp      
      }
    });
    return true;
  } catch (error) {
    console.error(`[OTP Service] Failed to send reset email:`, error);
    throw new Error('Failed to send password reset email.');
  }
};