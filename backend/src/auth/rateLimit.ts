import { createHash } from "node:crypto";
import asyncHandler from "../helpers/asyncHandler";
import { securityRedis } from "../dbs/init.redis";
import { ErrorResponse } from "../core/error.response";

export const authRateLimit = (
  limit: number,
  windowSeconds = 60,
  perAccount = false,
) =>
  asyncHandler(async (req, _res, next) => {
    const subject = perAccount
      ? String(req.body?.email ?? "")
          .trim()
          .toLowerCase()
          .slice(0, 100)
      : req.ip;
    const identity = createHash("sha256")
      .update(`${perAccount ? "account" : "ip"}:${subject}:${req.path}`)
      .digest("hex");
    const key = `auth:rate:${identity}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
    const result = await securityRedis((redis) =>
      redis
        .multi()
        .incr(key)
        .expire(key, windowSeconds + 1)
        .exec(),
    );
    if (Number(result[0]) > limit)
      throw new ErrorResponse("Too many attempts. Please wait a minute.", 429);
    next();
  });
