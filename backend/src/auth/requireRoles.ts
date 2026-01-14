import { Request, Response, NextFunction } from "express";
import { AuthFailureError, ForbiddenError } from "../core/error.response";
import { getRoles } from "../models/repositories/user.repo";

export const requireRoles = (allowed: string[]) => {
  const allowSet = new Set(allowed.map((r) => String(r).toUpperCase()));

  // log once (middleware creation time)
  console.log("[requireRoles:init] allowed =", allowed);
  console.log("[requireRoles:init] allowSet =", Array.from(allowSet));

  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const uid = user?.uid;

      console.log("\n[requireRoles:req]", req.method, req.originalUrl);
      console.log("[requireRoles:req] uid =", uid);

      if (!uid) throw new AuthFailureError("Unauthorised");

      const roles = await getRoles(uid);
      console.log("[requireRoles:db] roles raw =", roles);

      const normalized = (roles || []).map((r: any) => {
        // handle: "AUTHOR" OR { code: "AUTHOR" } OR { role_code: "AUTHOR" }
        const picked =
          typeof r === "string"
            ? r
            : r?.code ?? r?.role_code ?? r?.roleCode ?? r?.CODE ?? "";

        return String(picked).toUpperCase();
      });

      console.log("[requireRoles:check] normalized =", normalized);

      const has = normalized.some((code) => allowSet.has(code));
      console.log("[requireRoles:check] has =", has);

      if (!has) throw new ForbiddenError("Forbidden: insufficient role");

      next();
    } catch (err) {
      next(err);
    }
  };
};
