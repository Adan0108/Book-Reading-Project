import { generateKeyPair, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import jwt, { JwtPayload } from 'jsonwebtoken';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../dbs/init.mysql';
import { withTransaction } from '../dbs/transaction';
import { AuthFailureError } from '../core/error.response';

export interface SessionPayload extends JwtPayload {
  uid: number; email: string; sid: string; jti: string; token_use: 'access' | 'refresh';
}
const generate = promisify(generateKeyPair);
const issuer = 'hibook';
const audience = 'hibook-web';

async function lockedUser(db: PoolConnection, userId: number) {
  const [rows] = await db.query<RowDataPacket[]>('SELECT id,email,state,password_hash FROM users WHERE id=? FOR UPDATE', [userId]);
  if (!rows[0] || rows[0].state !== 1) throw new AuthFailureError('Account is not active');
  return rows[0];
}
async function signingKeys(db: PoolConnection, userId: number) {
  const [rows] = await db.query<RowDataPacket[]>('SELECT public_key,private_key FROM user_keys WHERE user_id=? FOR UPDATE', [userId]);
  if (rows[0]?.private_key.includes('BEGIN PRIVATE KEY')) return rows[0];
  // Legacy HMAC sessions intentionally require reauthentication. No content is changed.
  const keys = await generate('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  await db.query('INSERT INTO user_keys (user_id,public_key,private_key) VALUES (?,?,?) ON DUPLICATE KEY UPDATE public_key=VALUES(public_key),private_key=VALUES(private_key)', [userId,keys.publicKey,keys.privateKey]);
  return { public_key: keys.publicKey, private_key: keys.privateKey };
}
function sign(user: { id: number; email: string }, sid: string, refreshJti: string, key: string) {
  const base = { uid: Number(user.id), email: user.email, sid };
  const options = { algorithm: 'RS256' as const, issuer, audience };
  return {
    accessToken: jwt.sign({ ...base, jti: randomUUID(), token_use: 'access' }, key, { ...options, expiresIn: '15m' }),
    refreshToken: jwt.sign({ ...base, jti: refreshJti, token_use: 'refresh' }, key, { ...options, expiresIn: '7d' }),
  };
}
export async function issueSession(userId: number, expectedPasswordHash?: string) {
  return withTransaction(async db => {
    const user = await lockedUser(db,userId);
    if (expectedPasswordHash && user.password_hash !== expectedPasswordHash) throw new AuthFailureError('Credentials changed. Please sign in again.');
    const keys = await signingKeys(db,userId);
    const sid = randomUUID(), refreshJti = randomUUID();
    await db.query('INSERT INTO auth_sessions (id,user_id,refresh_jti,expires_at) VALUES (?,?,?,DATE_ADD(NOW(),INTERVAL 7 DAY))', [sid,userId,refreshJti]);
    return sign({id:userId,email:user.email},sid,refreshJti,keys.private_key);
  });
}
export async function verifySessionToken(raw: string, userId: number, purpose: 'access' | 'refresh'): Promise<SessionPayload> {
  const [keys] = await pool.query<RowDataPacket[]>('SELECT public_key FROM user_keys WHERE user_id=?', [userId]);
  if (!keys[0]?.public_key.includes('BEGIN PUBLIC KEY')) throw new AuthFailureError('Please sign in again');
  let payload: SessionPayload;
  try { payload = jwt.verify(raw,keys[0].public_key,{ algorithms:['RS256'],issuer,audience }) as SessionPayload; }
  catch { throw new AuthFailureError('Invalid or expired token'); }
  if (payload.uid !== userId || payload.token_use !== purpose || typeof payload.sid !== 'string' || typeof payload.jti !== 'string') throw new AuthFailureError('Invalid token purpose');
  const [sessions] = await pool.query<RowDataPacket[]>(`SELECT s.id FROM auth_sessions s JOIN users u ON u.id=s.user_id
    WHERE s.id=? AND s.user_id=? AND s.revoked_at IS NULL AND s.expires_at>NOW() AND u.state=1`, [payload.sid,userId]);
  if (!sessions.length) throw new AuthFailureError('Session expired or revoked');
  return payload;
}
export async function rotateSession(payload: SessionPayload) {
  const result = await withTransaction(async db => {
    const user = await lockedUser(db,payload.uid);
    const [sessions] = await db.query<RowDataPacket[]>('SELECT *,expires_at>NOW() AS valid FROM auth_sessions WHERE id=? AND user_id=? FOR UPDATE', [payload.sid,payload.uid]);
    const session = sessions[0];
    if (!session || session.revoked_at || !session.valid) throw new AuthFailureError('Session expired or revoked');
    if (session.refresh_jti !== payload.jti) {
      await db.query('UPDATE auth_sessions SET revoked_at=NOW() WHERE id=?', [payload.sid]);
      return null; // Commit family revocation even though the caller is rejected.
    }
    const refreshJti = randomUUID();
    const keys = await signingKeys(db,payload.uid);
    await db.query('UPDATE auth_sessions SET refresh_jti=?,expires_at=DATE_ADD(NOW(),INTERVAL 7 DAY) WHERE id=?', [refreshJti,payload.sid]);
    return sign({id:payload.uid,email:user.email},payload.sid,refreshJti,keys.private_key);
  });
  if (!result) throw new AuthFailureError('Refresh token reused. Please sign in again.');
  return result;
}
export async function revokeSession(sid: string, userId: number) {
  await pool.query('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE id=? AND user_id=?', [sid,userId]);
}
export async function revokeAllSessions(userId: number) {
  await pool.query('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=?', [userId]);
}
