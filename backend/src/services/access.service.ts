// src/api/services/access.service.ts
import bcrypt from 'bcrypt';
import * as userRepo from '../models/repositories/user.repo';
import { ConflictRequestError, BadRequestError } from '../core/error.response';

import { AuthFailureError } from '../core/error.response';
import { createTokenPair } from '../auth/authUtils';
import { redisService } from '../dbs/init.redis';

import jwt from 'jsonwebtoken';

import * as otpService from './otp.service';
import * as emailService from './email.service';

export const register = async ({ email, password, username }: { email: string; password: string; username: string; }) => {
  // 1. Check if user already exists
  const existingUser = await userRepo.findByEmail(email);
  if (existingUser) {
    throw new ConflictRequestError('Error: Email already registered!');
  }

  // 2. Hash the password
  const passwordHash = await bcrypt.hash(password, 10);

  // 3. Create the new user and profile
  const newUserId = await userRepo.createUser({ email, passwordHash, username });

  if (!newUserId) {
    throw new BadRequestError('Error: User could not be created!');
  }

  const { otp, otpHash, expiresAt } = await otpService.generateOtp();
  await otpService.saveOtpHash({ userId: newUserId, otpHash, expiresAt, otpType: 'EMAIL_OTP' }); // Specify type
  await emailService.sendRegistrationOtp({ email, otp }); // Create a new email template for this

  // 4. For sign-up, we don't return tokens. User must log in separately.
  //return { userId: newUserId };
  return { message: 'Registration successful. Please check your email for the verification OTP.' };
};

export const verifyRegistration = async ({ email, otp }: { email: string; otp: string; }) => {
  const user = await userRepo.findByEmail(email);
  if (!user || user.status !== 'UNVERIFIED') {
    throw new BadRequestError('Verification failed: User not found or already verified.');
  }

  const isOtpValid = await otpService.verifyOtp({ userId: user.id, otp, otpType: 'EMAIL_OTP' }); // Specify type
  if (!isOtpValid) {
    throw new BadRequestError('Invalid or expired OTP.');
  }

  // Update user status to ACTIVE and mark OTP as used
  await userRepo.updateUserStatus({ userId: user.id, status: 'ACTIVE' });
  await userRepo.markOtpAsVerified({ userId: user.id, otpType: 'EMAIL_OTP' });

  return { message: 'Account verified successfully. You can now log in.' };
};

export const login = async ({ email, password }: { email: string; password: string; }) => {
  // 1. Find user by email
  const user = await userRepo.findByEmail(email);
  if (!user) {
    throw new AuthFailureError('Authentication error: User not registered.');
  }

  // 2. Match password
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    throw new AuthFailureError('Authentication error: Incorrect password.');
  }

  // 3. Create tokens
  const tokens = await createTokenPair(user.id.toString());

  // 4. Return user info and tokens (controller will set cookies)
  return {
    user: { userId: user.id, email: user.email },
    tokens,
  };
};

export const logout = async (userId: string, jti: string) => {
    // Blacklist the token by adding its JTI to Redis [cite: 80, 838]
    const redisClient = redisService.getClient();
    if (!redisClient) throw new Error('Redis client not available');

    // Key format: BLACKLIST_{uid}_{jti} with TTL [cite: 107]
    const key = `BLACKLIST_${userId}_${jti}`;
    await redisClient.set(key, '1', {
        EX: 15 * 60 // Expire in 15 minutes (same as AT)
    });

    return { message: 'Logout successful' };
};

export const handleRefreshToken = async (refreshToken: string) => {
  try {
    // 1. Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_PUBLIC_KEY!, {
      algorithms: ['RS256'],
    }) as { sub: string };

    // 2. Ensure the user still exists
    // You may want to add a findById method to your user.repository.ts
    // For now, we'll check by email which requires decoding the user from the old AT or fetching them
    // A better approach is to ensure the user ID (`decoded.sub`) is valid
    const user = await userRepo.findById(parseInt(decoded.sub, 10)); // Assuming you add findById
    if (!user) {
      throw new AuthFailureError('User not registered');
    }

    // 3. Issue a new token pair (token rotation)
    const tokens = await createTokenPair(user.id.toString());

    return {
      user: { userId: user.id, email: user.email },
      tokens,
    };

  } catch (err: any) {
    // If the refresh token is expired or invalid, throw an error
    throw new AuthFailureError('Invalid or expired refresh token');
  }
};

export const forgotPassword = async ({ email }: { email: string; }) => {
  // 1. Check if user exists
  const user = await userRepo.findByEmail(email);
  if (!user) {
    throw new BadRequestError('User with this email does not exist.');
  }

  // 2. Generate and save OTP
  const { otp, otpHash, expiresAt } = await otpService.generateOtp();
  await otpService.saveOtpHash({ userId: user.id, otpHash, expiresAt, otpType: 'RESET' });

  // 3. Send OTP via email
  await emailService.sendResetPasswordOtp({ email, otp });

  return { message: 'Password reset OTP sent to your email.' };
};

export const resetPassword = async ({ email, otp, newPassword }: { email: string; otp: string; newPassword: string; }) => {
  // 1. Check if user exists
  const user = await userRepo.findByEmail(email);
  if (!user) {
    throw new BadRequestError('User with this email does not exist.');
  }

  // 2. Verify the OTP
  const isOtpValid = await otpService.verifyOtp({ userId: user.id, otp, otpType: 'RESET' });
  if (!isOtpValid) {
    throw new BadRequestError('Invalid or expired OTP.');
  }

  // 3. Hash the new password and update it
  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await userRepo.updatePassword({ userId: user.id, newPasswordHash });

  // 4. Invalidate all existing tokens for this user
  const redisClient = redisService.getClient();
  if (!redisClient) throw new Error('Redis client not available');

  const cutoffKey = `TOKEN_IAT_AVAILABLE_${user.id}`;
  const cutoffTimestamp = Math.floor(Date.now() / 1000);
  await redisClient.set(cutoffKey, cutoffTimestamp.toString());

  return { message: 'Password has been reset successfully.' };
};