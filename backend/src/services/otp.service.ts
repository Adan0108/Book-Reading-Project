import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { findRecentOtpByType, createVerification } from '../models/repositories/user.repo';

export const OTP_COOLDOWN_MINUTES = 1;

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
export const checkOtpCooldown = async (userId: number): Promise<number> => {
  const cooldownExpiresAt = new Date(Date.now() - OTP_COOLDOWN_MINUTES * 60 * 1000);
  const recentOtp = await findRecentOtpByType(userId, 'EMAIL_OTP', cooldownExpiresAt);

  if (recentOtp) {
    const now = Date.now();
    const createdAt = new Date(recentOtp.created_at).getTime();
    const cooldownMs = OTP_COOLDOWN_MINUTES * 60 * 1000;
    const remainingSeconds = Math.ceil((createdAt + cooldownMs - now) / 1000);
    return remainingSeconds > 0 ? remainingSeconds : 0;
  }
  return 0; // No cooldown
};

/**
 * Mocks sending an OTP to the user's email.
 */
export const sendOtpEmail = async (email: string, otp: string) => {
  console.log(`
    ================================================
    Mock Email Sent to: ${email}
    Your account verification OTP is: ${otp}
    (This OTP will expire in 5 minutes)
    ================================================
  `);
  return true;
};