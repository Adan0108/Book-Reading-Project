import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { pool } from '../dbs/init.mysql';
import { ResultSetHeader } from 'mysql2';

import { redisService } from '../dbs/init.redis';

/**
 * Generates a 6-digit OTP, its hash, and an expiry time.
 */
export const generateOtp = async () => {
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  // OTP expires in 5 minutes
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  return { otp, otpHash, expiresAt };
};

/**
 * Saves the OTP hash to the database for a user.
 */
export const saveOtpHash = async ({ userId, otpHash, expiresAt, otpType }: { userId: number; otpHash: string; expiresAt: Date; otpType: 'EMAIL_OTP' | 'RESET' }) => {
  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO user_verifications (user_id, type, otp_hash, expires_at) VALUES (?, ?, ?, ?)',
    [userId, otpType, otpHash, expiresAt] // Use the passed otpType
  );
  return result.insertId;
};

/**
 * Verifies a user-provided OTP against the latest one in the database.
 */
export const verifyOtp = async ({ userId, otp, otpType }: { userId: number; otp: string; otpType: 'EMAIL_OTP' | 'RESET' }) => {
  const [rows]: any[] = await pool.query(
    'SELECT otp_hash FROM user_verifications WHERE user_id = ? AND type = ? AND expires_at > NOW() AND is_verified = 0 ORDER BY created_at DESC LIMIT 1',
    [userId, otpType] // Use the passed otpType
  );

  if (!rows.length) {
    return false; // No valid OTP found
  }

  const { otp_hash } = rows[0];
  const isValid = await bcrypt.compare(otp, otp_hash);
  return isValid;
};