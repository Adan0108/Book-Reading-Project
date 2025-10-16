import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { create as createUser, findByEmail, addRole } from "../models/repositories/user.repo";
import { createProfile } from "../models/repositories/userProfile.repo";
import { getByUserId, upsert as upsertKeys } from "../models/repositories/userKeys.repo";
import type { UserKeysRow } from "../models/repositories/userKeys.repo";
import type { User } from "../models/user.model";
import { AuthFailureError, BadRequestError } from "../core/error.response";
import { createTokenPair, revokeToken } from "../auth/checkAuth";

/** Register:
 * - create user
 * - create profile (username = user<id>)
 * - assign READER role
 * - generate per-user key pair
 * - return tokens
 */
export async function register(email: string, password: string): Promise<{
  user: Pick<User, "id" | "email">;
  tokens: { accessToken: string; refreshToken: string };
}> {
  const existing = await findByEmail(email);
  if (existing) throw new BadRequestError("Email already registered");

  const hash = await bcrypt.hash(password, 12);
  const user = await createUser(email, hash);
  const id = Number(user.id);

  // profile
  await createProfile(id, `user${id}`);

  // role
  await addRole(id, "READER");

  // key pair (hex strings; consider KMS later)
  const publicKey = crypto.randomBytes(64).toString("hex");
  const privateKey = crypto.randomBytes(64).toString("hex");
  await upsertKeys(id, publicKey, privateKey);

  const tokens = await createTokenPair({ uid: id, email }, publicKey, privateKey);
  return { user: { id, email: user.email }, tokens };
}

/** Login:
 * - verify credentials
 * - ensure per-user key pair exists (create if missing)
 * - issue tokens
 */
export async function login(email: string, password: string): Promise<{
  user: Pick<User, "id" | "email">;
  tokens: { accessToken: string; refreshToken: string };
}> {
  const user = await findByEmail(email);
  if (!user) throw new AuthFailureError("Invalid credentials");
  if (!(await bcrypt.compare(password, user.password_hash))) throw new AuthFailureError("Invalid credentials");
  if (user.state === 0) throw new AuthFailureError("Account blocked");

  const id = Number(user.id);

  let keys: UserKeysRow; // <-- non-nullable
  const existing = await getByUserId(id);
  if (existing) {
    keys = existing;
  } else {
    const publicKey = crypto.randomBytes(64).toString("hex");
    const privateKey = crypto.randomBytes(64).toString("hex");
    await upsertKeys(id, publicKey, privateKey);
    keys = {
      user_id: id,
      public_key: publicKey,
      private_key: privateKey,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  const tokens = await createTokenPair({ uid: id, email }, keys.public_key, keys.private_key);
  return { user: { id, email: user.email }, tokens };
}

/** Logout:
 * - blacklist the current access token (middleware put decoded token into req.user)
 */
export async function logout(decodedAT: { uid: number; jti: string; exp?: number }) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = decodedAT.exp ? Math.max(decodedAT.exp - now, 1) : 24 * 60 * 60; 
  await revokeToken(decodedAT.uid, decodedAT.jti, ttl);
  return { ok: true };
}

/** refresh (requires RT middleware) */
export async function refreshTokens(
  userId: number,
  email: string,
  currentRtJti: string,
  rtExp?: number
) {
  const keys = await getByUserId(userId);
  if (!keys) throw new AuthFailureError("Key pair missing");

  // rotate refresh token: invalidate the current RT to prevent reuse
  if (currentRtJti) {
    const now = Math.floor(Date.now() / 1000);
    const ttl = rtExp ? Math.max(rtExp - now, 1) : 7 * 24 * 60 * 60;
    await revokeToken(userId, currentRtJti, ttl);
  }

  // mint a fresh pair (same per-user keys)
  return await createTokenPair({ uid: userId, email }, keys.public_key, keys.private_key);
}
