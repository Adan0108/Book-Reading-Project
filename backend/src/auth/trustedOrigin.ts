import type { RequestHandler } from 'express';
import { ForbiddenError } from '../core/error.response';

// Cookie endpoints also require x-client-id (a non-simple CORS header).
// Origin checking adds protection against requests from a different same-site origin.
export const trustedAuthOrigin: RequestHandler = (req,_res,next) => {
  const origin=req.get('origin');
  if (origin && origin !== (process.env.FRONTEND_URL || 'http://localhost:8000')) return next(new ForbiddenError('Untrusted request origin'));
  next();
};
