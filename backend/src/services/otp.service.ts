import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { getRemainingCooldown, createVerification } from '../models/repositories/user.repo';
import sendMail from '../utils/sendMail';

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
  return await getRemainingCooldown(
    userId,
    'EMAIL_OTP',
    OTP_COOLDOWN_MINUTES
  );
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
 * Sending an OTP to the user's email.
 */
export const sendOtpEmail = async (email: string, otp: string) => {
  try {
    await sendMail({
      email: email,
      subject: 'Your Verification Code - Book Project',
      template: 'otp-mail.ejs',
      data: {
        email: email, // Pass the email to the template
        otp: otp      // Pass the OTP to the template
      }
    });
    return true;
  } catch (error) {
    console.error(`[OTP Service] Failed to send email via sendMail service:`, error);
    return false;
  }
};