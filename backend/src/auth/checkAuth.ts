import jwt, { JwtPayload } from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import asyncHandler from "../helpers/asyncHandler";
import { getByUserId } from "../models/repositories/userKeys.repo";
import { getRedis } from "../dbs/init.redis";
import { AuthFailureError, NotFoundError, RedisErrorResponse } from "../core/error.response";

/** request header names */
export const HEADER = {
  CLIENT_ID: "x-client-id",
  AUTHORIZATION: "authorization",
  REFRESHTOKEN: "x-rtoken-id",
} as const;

export type AccessPayload = JwtPayload & {
  uid: number;       // user id
  email: string;
  jti: string;       // unique token id for revocation
};

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

/** create AT (signed with publicKey) + RT (signed with privateKey) */
export async function createTokenPair(
  payload: Pick<AccessPayload, "uid" | "email">,
  publicKey: string,
  privateKey: string
) {
  const base: AccessPayload = {
    uid: payload.uid,
    email: payload.email,
    jti: uuidv4(),
    iat: Math.floor(Date.now() / 1000),
  };

  const accessToken = jwt.sign(base, publicKey, { expiresIn: "2d" });
  const refreshToken = jwt.sign(base, privateKey, { expiresIn: "7d" });
  return { accessToken, refreshToken };
}

export function verifyJWT<T extends object = any>(token: string, key: string): T {
  return jwt.verify(token, key) as T;
}

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

/** Authentication middleware:
 * - expects x-client-id: <userId>
 * - prefers Authorization: Bearer <AT>, but also supports x-rtoken-id for RT flows
 * - verifies against per-user public/private keys
 * - rejects revoked tokens via Redis blacklist
 */
/** Access Token only (for protected routes) */
export const authenticationV2 = asyncHandler(async (req, _res, next) => {
  const cid = req.headers[HEADER.CLIENT_ID];
  const userId = Number(Array.isArray(cid) ? cid[0] : cid);
  if (!userId || Number.isNaN(userId)) throw new AuthFailureError("Invalid Request (x-client-id)");

  const keyPair = await getByUserId(userId);
  if (!keyPair) throw new NotFoundError("Key pair not found");

  const auth = req.headers[HEADER.AUTHORIZATION];
  if (!auth) throw new AuthFailureError("Missing Authorization");
  const bearer = Array.isArray(auth) ? auth[0] : auth;
  const raw = bearer.includes(" ") ? bearer.split(" ")[1] : bearer;

  try {
    const decoded = verifyJWT<AccessPayload>(raw, keyPair.public_key);
    if (decoded.uid !== userId) throw new AuthFailureError("Invalid user (AT)");
    if (await isRevoked(decoded.uid, decoded.jti)) throw new AuthFailureError("Token revoked");
    req.user = decoded;
    req.keyStore = { publicKey: keyPair.public_key, privateKey: keyPair.private_key };
    next();
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") {
      throw new AuthFailureError("Access token expired"); // client should call /refresh
    }
    throw err;
  }
});

/** Refresh Token only (for /refresh) */
export const requireRefreshToken = asyncHandler(async (req, _res, next) => {
  const cid = req.headers[HEADER.CLIENT_ID];
  const userId = Number(Array.isArray(cid) ? cid[0] : cid);
  if (!userId || Number.isNaN(userId)) throw new AuthFailureError("Invalid Request (x-client-id)");

  const keyPair = await getByUserId(userId);
  if (!keyPair) throw new NotFoundError("Key pair not found");

  const rtHeader = req.headers[HEADER.REFRESHTOKEN];
  if (!rtHeader) throw new AuthFailureError("Missing refresh token");
  const rt = Array.isArray(rtHeader) ? rtHeader[0] : rtHeader;

  const decoded = verifyJWT<AccessPayload>(rt, keyPair.private_key);
  if (decoded.uid !== userId) throw new AuthFailureError("Invalid user (RT)");
  if (await isRevoked(decoded.uid, decoded.jti)) throw new AuthFailureError("Token revoked");

  req.user = decoded;
  req.refreshToken = rt;
  req.keyStore = { publicKey: keyPair.public_key, privateKey: keyPair.private_key };
  next();
});
