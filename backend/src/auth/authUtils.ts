// src/api/auth/authUtils.ts
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

interface TokenPayload {
  sub: string; // User ID
  jti: string; // JWT ID
}

// Add this line for debugging
console.log("My Private Key:", process.env.JWT_PRIVATE_KEY);
console.log("My Public Key:", process.env.JWT_PUBLIC_KEY);

export const createTokenPair = async (userId: string) => {
  const jti = crypto.randomUUID();
  const payload: TokenPayload = { sub: userId, jti };

  // Access Token (AT) - 15 minutes expiry [cite: 86]
  const accessToken = jwt.sign(payload, process.env.JWT_PRIVATE_KEY!, {
    algorithm: 'RS256',
    expiresIn: '15m',
  });

  // Refresh Token (RT) - 30 days expiry [cite: 88]
  const refreshToken = jwt.sign({ sub: userId }, process.env.JWT_PRIVATE_KEY!, {
    algorithm: 'RS256',
    expiresIn: '30d',
  });

  return { accessToken, refreshToken };
};