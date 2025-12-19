import { Request, Response, NextFunction } from "express";
import { AuthFailureError, ForbiddenError } from "../core/error.response";
import { getRoles } from "../models/repositories/user.repo";

export const requireRoles = (allowed: string[]) => {
  const allowSet  = new Set(allowed.map(role => role.toUpperCase()));

  return async(req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      const uid = user.userId
      if(!uid) throw new AuthFailureError("Unauthorised");

      const roles = await getRoles(uid);
      const has = roles.some((role: any) => allowSet.has(String(role.code).toUpperCase()))

      if(!has) throw new ForbiddenError("Forbidden: insufficient role");

      next();
    }
    catch(err){
      next(err)
    }
  }
}