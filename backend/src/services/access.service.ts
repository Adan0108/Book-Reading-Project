import bcrypt from "bcrypt";
import { create as createUser, findByEmail, addRole } from "../models/repositories/user.repo";
import type { User } from "../models/user.model";
import { AuthFailureError, BadRequestError } from "../core/error.response";

/**
 * Simple Auth Service:
 * - register: creates user + default READER role
 * - login: verify email/password
 * - logout: (placeholder) – integrate Redis blacklist later
 */
export async function register(email: string, password: string): Promise<Pick<User, "id"|"email">> {
  const existing = await findByEmail(email);
  if (existing) throw new BadRequestError("Email already registered");

  const hash = await bcrypt.hash(password, 12);
  const user = await createUser(email, hash);

  // default role
  await addRole(Number(user.id), "READER");

  return { id: Number(user.id), email: user.email };
}

export async function login(email: string, password: string): Promise<Pick<User, "id"|"email">> {
  const user = await findByEmail(email);
  if (!user) throw new AuthFailureError("Invalid credentials");

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new AuthFailureError("Invalid credentials");

  return { id: Number(user.id), email: user.email };
}

export async function logout(_sessionOrJti?: string): Promise<{ ok: true }> {
  // TODO: add to Redis blacklist or clear session
  return { ok: true };
}
