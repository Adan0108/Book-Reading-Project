import jwt from "jsonwebtoken";
import { verifySessionToken, type SessionPayload } from "../services/session.service";
import asyncHandler from "../helpers/asyncHandler";

import { getRedis } from "../dbs/init.redis";
import { AuthFailureError, RedisErrorResponse } from "../core/error.response";
import { rtCookieName, atCookieName } from "../utils/cookieOptions";

/** request header names */
export const HEADER = {
  CLIENT_ID: "x-client-id",
  AUTHORIZATION: "authorization",
  REFRESHTOKEN: "x-rtoken-id",
} as const;

export type AccessPayload = SessionPayload;

function requireRedis() {
  const client = getRedis();
  if (!client) throw new RedisErrorResponse("Redis not ready");
  return client;
}

/** key used to blacklist a token (by user + jti) */
export function blacklistKey(uid: number, jti: string) {
  return `TOKEN_BLACK_LIST_${uid}_${jti}`;
}

export async function isRevoked(uid: number, jti: string): Promise<boolean> {
  const client = requireRedis();
  const key = blacklistKey(uid, jti);
  const val = await client.get(key);
  return Boolean(val);
}

export async function revokeToken(uid: number, jti: string, expSeconds?: number) {
  const client = requireRedis();
  const key = blacklistKey(uid, jti);
  if (expSeconds && expSeconds > 0) {
    await client.setEx(key, expSeconds, "1");
  } else {
    await client.set(key, "1");
  }
}

/** Tokens are purpose-bound RS256 JWTs backed by durable session rows. */
export const verifyJWT = <T extends object = SessionPayload>(token: string, key: string): T =>
  jwt.verify(token,key,{ algorithms:['RS256'],issuer:'hibook',audience:'hibook-web' }) as T;

/** augment Express.Request with auth context */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessPayload;
      keyStore?: { publicKey: string; privateKey: string };
      refreshToken?: string;
    }
  }
}

/** Protected routes accept access Bearer tokens only; refresh uses its HttpOnly cookie. */
function clientId(req: import('express').Request) {
  const value = req.headers[HEADER.CLIENT_ID];
  const userId = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isSafeInteger(userId) || userId < 1) throw new AuthFailureError('Invalid Request (x-client-id)');
  return userId;
}
export const authenticationV2 = asyncHandler(async (req, _res, next) => {
  const userId = clientId(req);
  const auth = req.headers.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) throw new AuthFailureError('Missing Authorization');
  const payload = await verifySessionToken(auth.slice(7),userId,'access');
  if (await isRevoked(payload.uid,payload.jti)) throw new AuthFailureError('Token revoked');
  req.user = payload;
  next();
});
export const requireRefreshToken = asyncHandler(async (req, _res, next) => {
  const userId = clientId(req);
  const raw = req.cookies?.[rtCookieName];
  if (typeof raw !== 'string') throw new AuthFailureError('Missing refresh token cookie');
  req.user = await verifySessionToken(raw,userId,'refresh');
  next();
});
export const requireAccessCookie = asyncHandler(async (req,_res,next)=>{
  const raw=req.cookies?.[atCookieName];
  if(typeof raw!=='string') throw new AuthFailureError('Access cookie expired');
  const payload=await verifySessionToken(raw,clientId(req),'access');
  if(await isRevoked(payload.uid,payload.jti)) throw new AuthFailureError('Token revoked');
  req.user=payload;
  next();
});
