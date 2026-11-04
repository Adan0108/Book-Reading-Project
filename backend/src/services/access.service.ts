import bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'node:crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { BadRequestError, ConflictRequestError, AuthFailureError } from '../core/error.response';
import { pool } from '../dbs/init.mysql';
import { withTransaction } from '../dbs/transaction';
import * as UserRepo from '../models/repositories/user.repo';
import * as OtpService from './otp.service';
import { issueSession, rotateSession, revokeSession, type SessionPayload } from './session.service';

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string' || value.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new BadRequestError('Enter a valid email address');
  return value.trim().toLowerCase();
}
export function validatePassword(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length < 12 || Buffer.byteLength(value,'utf8') > 72) throw new BadRequestError('Use at least 12 characters and at most 72 UTF-8 bytes for your password');
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const pending = (u: { state: number; password_hash: string }) => [0,2].includes(u.state) && u.password_hash === '---PENDING_SETUP---';

async function sendCode(email: string, type: 'EMAIL_OTP' | 'RESET') {
  let user = await UserRepo.findByEmail(email);
  if (type === 'RESET' && (!user || user.state !== 1)) return { message:'If this account is active, a reset code will be sent.',cooldown:60 };
  if (type === 'EMAIL_OTP') {
    if (user && !pending(user)) throw new ConflictRequestError('This account cannot be registered again. Sign in or contact support.');
    if (!user) user = await UserRepo.createInactiveUser(email);
  }
  const uid = user!.id;
  const { otp,otpHash } = await OtpService.generateOtp();
  await withTransaction(async db => {
    const [users]=await db.query<RowDataPacket[]>('SELECT state,password_hash FROM users WHERE id=? FOR UPDATE',[uid]);
    const current=users[0];
    if (!current || (type==='RESET' ? current.state!==1 : !pending(current as {state:number;password_hash:string}))) throw new AuthFailureError('Account verification unavailable');
    const [recent]=await db.query<RowDataPacket[]>('SELECT id FROM user_verifications WHERE user_id=? AND type=? AND created_at>DATE_SUB(NOW(),INTERVAL 1 MINUTE) LIMIT 1',[uid,type]);
    if(recent.length) throw new BadRequestError('Wait one minute before requesting another code');
    await db.query('UPDATE user_verifications SET is_verified=1 WHERE user_id=? AND type=?',[uid,type]);
    await db.query('INSERT INTO user_verifications(user_id,type,otp_hash,expires_at) VALUES (?,?,?,DATE_ADD(NOW(),INTERVAL 5 MINUTE))',[uid,type,otpHash]);
    await OtpService.clearOtpAttempts(uid,type);
  });
  if (type === 'RESET') await OtpService.sendResetPasswordOtpEmail(email,otp);
  else await OtpService.sendOtpEmail(email,otp);
  return { message:'Verification code sent.',cooldown:60 };
}
export const registerEmail = (email: string) => sendCode(normalizeEmail(email),'EMAIL_OTP');
export const resendOtp = (email: string) => sendCode(normalizeEmail(email),'EMAIL_OTP');
export const forgotPassword = (email: string) => sendCode(normalizeEmail(email),'RESET');

async function consumeOtp<T>(email: string, otp: string, type: 'EMAIL_OTP' | 'RESET', work: (db: PoolConnection, user: RowDataPacket) => Promise<T>) {
  const user = await UserRepo.findByEmail(normalizeEmail(email));
  if (!user || (type === 'RESET' ? user.state !== 1 : !pending(user))) throw new BadRequestError('No eligible verification found');
  await OtpService.checkOtpAttempts(user.id,type);
  const verification = await UserRepo.findActiveOtpByType(user.id,type);
  if (!verification || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) throw new BadRequestError('Invalid or expired verification code');
  if (!await bcrypt.compare(otp,verification.otp_hash!)) await OtpService.incrementOtpAttempts(user.id,type,verification);
  const result = await withTransaction(async db => {
    const [users] = await db.query<RowDataPacket[]>('SELECT * FROM users WHERE id=? FOR UPDATE',[user.id]);
    if (!users[0] || (type === 'RESET' ? users[0].state !== 1 : !pending(users[0] as {state:number;password_hash:string}))) throw new AuthFailureError('Verification is no longer valid');
    const [codes] = await db.query<RowDataPacket[]>('SELECT id FROM user_verifications WHERE id=? AND user_id=? AND type=? AND is_verified=0 AND expires_at>NOW() FOR UPDATE',[verification.id,user.id,type]);
    if (!codes.length) throw new AuthFailureError('Verification is expired or already used');
    await db.query('UPDATE user_verifications SET is_verified=1 WHERE user_id=? AND type=?',[user.id,type]);
    return work(db,users[0]);
  });
  await OtpService.clearOtpAttempts(user.id,type);
  return result;
}
export async function verifyEmail(email: string, otp: string) {
  const setupToken = randomBytes(32).toString('hex');
  return consumeOtp(email,otp,'EMAIL_OTP',async (db,user) => {
    await db.query('UPDATE users SET state=2 WHERE id=?',[user.id]);
    await db.query('UPDATE auth_setup_proofs SET consumed_at=NOW() WHERE user_id=? AND consumed_at IS NULL',[user.id]);
    await db.query('INSERT INTO auth_setup_proofs (token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 10 MINUTE))',[digest(setupToken),user.id]);
    return { message:'Email verified. Complete your account within ten minutes.',setupToken };
  });
}
export async function setupPassword(email: string, password: string, username: string, setupToken?: string) {
  email = normalizeEmail(email); validatePassword(password);
  if (typeof username !== 'string' || !/^[\p{L}\p{N}_-]{3,50}$/u.test(username)) throw new BadRequestError('Username must contain 3 to 50 letters, numbers, hyphens or underscores');
  if (typeof setupToken !== 'string' || !/^[a-f0-9]{64}$/.test(setupToken)) throw new AuthFailureError('Verify your email before setting a password');
  const hash = await bcrypt.hash(password,12);
  return withTransaction(async db => {
    const [users] = await db.query<RowDataPacket[]>('SELECT * FROM users WHERE email=? FOR UPDATE',[email]);
    const user = users[0];
    if (!user || user.state !== 2 || !pending(user as {state:number;password_hash:string})) throw new AuthFailureError('Account setup is unavailable');
    const [proofs] = await db.query<RowDataPacket[]>('SELECT token_hash FROM auth_setup_proofs WHERE token_hash=? AND user_id=? AND consumed_at IS NULL AND expires_at>NOW() FOR UPDATE',[digest(setupToken),user.id]);
    if (!proofs.length) throw new AuthFailureError('Setup authorization expired or already used. Verify your email again.');
    await db.query('UPDATE auth_setup_proofs SET consumed_at=NOW() WHERE token_hash=?',[digest(setupToken)]);
    await db.query('UPDATE users SET password_hash=?,state=1 WHERE id=?',[hash,user.id]);
    await db.query('INSERT INTO user_profiles (user_id,username,is_private) VALUES (?,?,0)',[user.id,username]);
    await db.query("INSERT IGNORE INTO user_roles (user_id,role_id) SELECT ?,id FROM roles WHERE code='READER'",[user.id]);
    return { message:'Account setup complete.',user:{id:user.id,email:user.email,username} };
  }).catch((error: {code?:string}) => {
    if (error.code === 'ER_DUP_ENTRY') throw new ConflictRequestError('This username is already in use. Choose another username.');
    throw error;
  });
}
export async function resetPassword(email: string, otp: string, newPassword: string) {
  validatePassword(newPassword);
  const hash = await bcrypt.hash(newPassword,12);
  return consumeOtp(email,otp,'RESET',async (db,user) => {
    await db.query('UPDATE users SET password_hash=? WHERE id=?',[hash,user.id]);
    await db.query('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=?',[user.id]);
    return { message:'Password reset. All sessions have been signed out.' };
  });
}
export async function login(email: string, password: string) {
  const user = await UserRepo.findByEmail(normalizeEmail(email));
  if (typeof password !== 'string' || Buffer.byteLength(password,'utf8') > 72 || !user || user.state !== 1 || !await bcrypt.compare(password,user.password_hash)) throw new AuthFailureError('Invalid credentials');
  return { user:{id:Number(user.id),email:user.email},tokens:await issueSession(Number(user.id),user.password_hash) };
}
export async function logout(payload: SessionPayload) {
  await revokeSession(payload.sid,payload.uid);
  return {ok:true};
}
export const refreshTokens = (payload: SessionPayload) => rotateSession(payload);
