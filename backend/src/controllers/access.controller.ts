
import { CREATED } from '../core/success.response';
import * as accessService from '../services/access.service';
import { Request, Response, NextFunction } from 'express';
import { OK, SuccessResponse } from '../core/success.response';
import { AuthFailureError } from '../core/error.response';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  new CREATED({
    message: 'Registration request successful!',
    metadata: await accessService.register(req.body),
  }).send(res);
};

export const verifyRegistration = async (req: Request, res: Response, next: NextFunction) => {
  new OK(
    'Verification successful.',
    await accessService.verifyRegistration(req.body)
  ).send(res);
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
    const { user, tokens } = await accessService.login(req.body);

    // Set tokens in HttpOnly cookies for web clients [cite: 89, 96, 97]
    res.cookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Use 'true' in production
        sameSite: 'lax',
        path: '/'
    });

    res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/v1/auth' // More specific path for RT
    });

    new SuccessResponse({
        message: 'Login successful!',
        metadata: { user },
    }).send(res);
};

export const logout = async (req: any, res: Response, next: NextFunction) => {
  // Assumes middleware has attached user info to req.user
  await accessService.logout(req.user.sub, req.user.jti);

  // Clear cookies
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });

  // FIX: Pass the message as a direct string
  new OK('Logout OK!').send(res);
};

export const handleRefreshToken = async (req: Request, res: Response, next: NextFunction) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    throw new AuthFailureError('Invalid Request: No refresh token');
  }

  const { user, tokens } = await accessService.handleRefreshToken(refreshToken);

  // Set new tokens in HttpOnly cookies
  res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
  });

  res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth'
  });

  new SuccessResponse({
      message: 'Token refreshed successfully!',
      metadata: { user },
  }).send(res);
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  new OK(
    'Forgot password request successful.',
    await accessService.forgotPassword(req.body),
  ).send(res);
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  new OK(
    'Password reset successful.',
    await accessService.resetPassword(req.body),
  ).send(res);
};

