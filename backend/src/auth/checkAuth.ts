import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthFailureError, ForbiddenError } from '../core/error.response';
import { asyncHandler } from '../helpers/asyncHandler';
import { redisService } from '../dbs/init.redis';

// Extend the Express Request type to include the 'user' property
interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    jti: string;
    iat: number;
  };
}

export const authenticateToken = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // 1. Read Access Token from cookie (for web)
  const token = req.cookies?.accessToken;
  if (!token) {
    throw new AuthFailureError('Invalid Request: No token provided');
  }

  try {
    // 2. Verify the token with the public key
    const decoded = jwt.verify(token, process.env.JWT_PUBLIC_KEY!, {
      algorithms: ['RS256'],
    }) as { sub: string; jti: string; iat: number; exp: number };

    const redisClient = redisService.getClient();
    if (!redisClient) throw new Error('Redis client not available');

    // 3. Blacklist check: See if the token's JTI is in Redis
    const blKey = `BLACKLIST_${decoded.sub}_${decoded.jti}`;
    const isRevoked = await redisClient.get(blKey);
    if (isRevoked) {
      throw new AuthFailureError('Token has been revoked');
    }
    
    // (Optional but recommended) Password-change cutoff check
    // This ensures old tokens are invalid after a password change.
    const cutoffKey = `TOKEN_IAT_AVAILABLE_${decoded.sub}`;
    const cutoffStr = await redisClient.get(cutoffKey);
    if (cutoffStr) {
        const cutoff = parseInt(cutoffStr, 10);
        if (decoded.iat < cutoff) {
            throw new AuthFailureError('Token invalidated due to password change');
        }
    }

    // 4. Attach user info to the request for later use
    req.user = { sub: decoded.sub, jti: decoded.jti, iat: decoded.iat };
    next();

  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw new AuthFailureError('Token expired');
    }
    if (err.name === 'JsonWebTokenError') {
      throw new AuthFailureError('Invalid token');
    }
    throw new ForbiddenError(err.message || 'Permission denied');
  }
});