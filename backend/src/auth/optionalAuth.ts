import asyncHandler from '../helpers/asyncHandler';
import { authenticationV2 } from './checkAuth';
export const optionalAuthenticationV2 = asyncHandler(async (req,res,next) => {
  if (!req.headers.authorization) return next();
  return authenticationV2(req,res,next);
});
