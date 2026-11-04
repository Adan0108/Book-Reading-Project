import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {configureQaEnvironment} from './qa-environment';
// Delivery boundary only: real OTP generation, bcrypt, MySQL, Redis, JWT and middleware.
const inbox = vi.hoisted(() => new Map<string,string>());
vi.mock('../src/utils/sendMail', () => ({ default: async ({email,data}: {email:string;data:{otp:string}}) => { inbox.set(email,data.otp); } }));
const enabled = process.env.PUBLISHING_TEST_DATABASE === 'publishing_qa';
describe.skipIf(!enabled)('real MySQL authentication and author provisioning', () => {
  let pool: typeof import('../src/dbs/init.mysql').pool;
  let redis: typeof import('../src/dbs/init.redis');
  let access: typeof import('../src/services/access.service');
  let sessions: typeof import('../src/services/session.service');
  const app = express();
  const email = `auth-${randomUUID()}@example.invalid`;
  const password = 'Test-only-password-2026!';
  const username = `Reader-${randomUUID()}`;
  let uid: number;
  let tokens: {accessToken:string;refreshToken:string};
  let sessionCookie:string;
  const headers = () => ({'x-client-id':String(uid),Authorization:`Bearer ${tokens.accessToken}`});
  beforeAll(async () => {
    configureQaEnvironment();
    ({pool}=await import('../src/dbs/init.mysql'));
    const {runMigrationsOnce}=await import('../src/dbs/migrate'); await runMigrationsOnce(); await runMigrationsOnce();
    redis=await import('../src/dbs/init.redis'); await redis.initRedis();
    access=await import('../src/services/access.service'); sessions=await import('../src/services/session.service');
    const routes=(await import('../src/routes')).default;
    app.use(express.json()); app.use(cookieParser()); app.use(routes);
    app.use((err:any,_req:any,res:any,_next:any)=>res.status(err.status??500).json({message:err.message}));
  },30000);
  afterAll(async()=>{await pool?.end(); await redis?.closeRedis();});
  it('registers with a delivered one-time code, requires a caller-bound setup proof and rejects OTP reuse',async()=>{
    await access.registerEmail(email);
    const [[u]]:any=await pool.query('SELECT id FROM users WHERE email=?',[email]); uid=u.id;
    await expect(access.verifyEmail(email,'000000')).rejects.toMatchObject({status:401});
    await expect(access.setupPassword(email,password,'Reader')).rejects.toMatchObject({status:401});
    const proof=await access.verifyEmail(email,inbox.get(email)!);
    await expect(access.verifyEmail(email,inbox.get(email)!)).rejects.toBeDefined();
    await expect(access.setupPassword(email,password,'Reader','a'.repeat(64))).rejects.toMatchObject({status:401});
    const result=await access.setupPassword(email,password,username,proof.setupToken);
    expect(result.user.id).toBe(uid);
    await expect(access.setupPassword(email,password,'Reader',proof.setupToken)).rejects.toMatchObject({status:401});
    tokens=(await access.login(email,password)).tokens;
    expect(jwt.decode(tokens.accessToken,{complete:true})?.header.alg).toBe('RS256');
    expect((await request(app).get('/v1/api/user/me').set(headers())).status).toBe(200);
    const response=await request(app).post('/v1/api/access/login').send({email,password});
    expect(response.status).toBe(200); expect(response.body.metadata.tokens.refreshToken).toBeUndefined();
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
    sessionCookie=response.headers['set-cookie'].find((c:string)=>c.startsWith('at=')).split(';')[0];
    const restored=await request(app).post('/v1/api/access/session').set('x-client-id',String(uid)).set('Cookie',sessionCookie);
    expect(restored.status).toBe(200);
    expect(restored.body.metadata.tokens.accessToken).toBe(response.body.metadata.tokens.accessToken);
    expect(restored.headers['set-cookie']).toBeUndefined(); // Restoration never rotates or extends cookies.
  });
  it('rejects expired OTPs and expired setup proofs',async()=>{
    const other=`expired-${randomUUID()}@example.invalid`; await access.registerEmail(other);
    await pool.query('UPDATE user_verifications v JOIN users u ON u.id=v.user_id SET v.expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE u.email=?',[other]);
    await expect(access.verifyEmail(other,inbox.get(other)!)).rejects.toMatchObject({status:400});
    await pool.query('UPDATE user_verifications v JOIN users u ON u.id=v.user_id SET v.expires_at=DATE_ADD(NOW(),INTERVAL 5 MINUTE) WHERE u.email=?',[other]);
    const proof=await access.verifyEmail(other,inbox.get(other)!);
    await pool.query('UPDATE auth_setup_proofs p JOIN users u ON u.id=p.user_id SET p.expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE u.email=?',[other]);
    await expect(access.setupPassword(other,password,'Expired',proof.setupToken)).rejects.toMatchObject({status:401});
  });
  it('bounds failed OTP attempts and rejects even the correct code after exhaustion',async()=>{
    const other=`attempts-${randomUUID()}@example.invalid`; await access.registerEmail(other);
    for(let i=0;i<10;i++) await expect(access.verifyEmail(other,'000000')).rejects.toMatchObject({status:401});
    await expect(access.verifyEmail(other,inbox.get(other)!)).rejects.toMatchObject({status:400});
  });
  it('rejects untrusted origins before processing cookie authentication',async()=>{
    expect((await request(app).post('/v1/api/access/refresh').set('Origin','https://untrusted.example')).status).toBe(403);
  });
  it('binds token purpose, algorithm and caller identity; denies readers author/admin routes',async()=>{
    const endpoint='/v1/api/authors/me/books';
    expect((await request(app).get(endpoint).set(headers())).status).toBe(403);
    expect((await request(app).get('/v1/api/admin/author-applications').set(headers())).status).toBe(403);
    for (const invalid of [tokens.refreshToken, jwt.sign({uid},'forged-hmac'), 'forged']) {
      expect((await request(app).get('/v1/api/user/me').set({...headers(),Authorization:`Bearer ${invalid}`})).status).toBe(401);
    }
    expect((await request(app).get('/v1/api/user/me').set({...headers(),'x-client-id':String(uid+1)})).status).toBe(401);
  });
  it('enforces individual access-token JTI revocation',async()=>{
    const isolated=await sessions.issueSession(uid);
    const claims=await sessions.verifySessionToken(isolated.accessToken,uid,'access');
    const {revokeToken}=await import('../src/auth/checkAuth');
    await revokeToken(uid,claims.jti,900);
    expect((await request(app).get('/v1/api/user/me').set({'x-client-id':String(uid),Authorization:`Bearer ${isolated.accessToken}`})).status).toBe(401);
  });
  it('rotates atomically, rejects concurrent replay and durably revokes the compromised session family',async()=>{
    const payload=await sessions.verifySessionToken(tokens.refreshToken,uid,'refresh');
    const results=await Promise.allSettled([sessions.rotateSession(payload),sessions.rotateSession(payload)]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
    await expect(sessions.verifySessionToken(tokens.accessToken,uid,'access')).rejects.toMatchObject({status:401});
    const winner=results.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<typeof tokens>;
    await expect(sessions.verifySessionToken(winner.value.refreshToken,uid,'refresh')).rejects.toMatchObject({status:401});
    tokens=(await access.login(email,password)).tokens;
    const rotated=await sessions.rotateSession(await sessions.verifySessionToken(tokens.refreshToken,uid,'refresh'));
    await expect(sessions.rotateSession(await sessions.verifySessionToken(tokens.refreshToken,uid,'refresh'))).rejects.toMatchObject({status:401});
    await expect(sessions.verifySessionToken(rotated.accessToken,uid,'access')).rejects.toMatchObject({status:401});
  });
  it('resets a password once and invalidates every previously issued access and refresh token',async()=>{
    tokens=(await access.login(email,password)).tokens;
    const second=(await access.login(email,password)).tokens;
    await access.forgotPassword(email); const code=inbox.get(email)!;
    await access.resetPassword(email,code,`${password}new`);
    expect((await request(app).post('/v1/api/access/session').set('x-client-id',String(uid)).set('Cookie',sessionCookie)).status).toBe(401);
    for(const pair of [tokens,second]) for(const purpose of ['access','refresh'] as const) {
      await expect(sessions.verifySessionToken(purpose==='access'?pair.accessToken:pair.refreshToken,uid,purpose)).rejects.toMatchObject({status:401});
    }
    await expect(access.resetPassword(email,code,password)).rejects.toBeDefined();
    await expect(access.login(email,password)).rejects.toMatchObject({status:401});
    tokens=(await access.login(email,`${password}new`)).tokens;
  });
  it('supports durable logout, logout-all, and immediate blocked-account rejection',async()=>{
    await access.logout(await sessions.verifySessionToken(tokens.accessToken,uid,'access'));
    await expect(sessions.verifySessionToken(tokens.refreshToken,uid,'refresh')).rejects.toMatchObject({status:401});
    tokens=(await access.login(email,`${password}new`)).tokens;
    const second=(await access.login(email,`${password}new`)).tokens;
    expect((await request(app).post('/v1/api/access/logout-all').set(headers())).status).toBe(200);
    await expect(sessions.verifySessionToken(second.accessToken,uid,'access')).rejects.toMatchObject({status:401});
    tokens=(await access.login(email,`${password}new`)).tokens;
    await pool.query('UPDATE users SET state=0 WHERE id=?',[uid]);
    expect((await request(app).get('/v1/api/user/me').set(headers())).status).toBe(401);
    await expect(access.registerEmail(email)).rejects.toMatchObject({status:409});
    await pool.query('UPDATE users SET state=1 WHERE id=?',[uid]);
  });
  it('rejects expired sessions and a login whose checked password changed before session issuance',async()=>{
    const expired=await sessions.issueSession(uid);
    const payload=jwt.decode(expired.accessToken) as {sid:string};
    await pool.query('UPDATE auth_sessions SET expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE id=?',[payload.sid]);
    await expect(sessions.verifySessionToken(expired.accessToken,uid,'access')).rejects.toMatchObject({status:401});
    await expect(sessions.issueSession(uid,'stale-password-hash')).rejects.toMatchObject({status:401});
  });
  it('atomically provisions an approved author and allows publishing while preserving admin boundaries',async()=>{
    const application=(await import('../src/services/application.service'));
    const submitted=await application.submitApplication(uid,{applicationTitle:'My author application',sampleTitle:'First story',sampleStory:'A new story. '.repeat(100),penName:'QA writer'},{ip:'127.0.0.1',userAgent:'test'});
    const [admin]:any=await pool.query('INSERT INTO users(email,password_hash,state) VALUES (?, ?,1)',[`admin-${randomUUID()}@example.invalid`,'test-only']);
    await pool.query("INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE code='ADMIN'",[admin.insertId]);
    const adminTokens=await sessions.issueSession(admin.insertId);
    const response=await request(app).post(`/v1/api/admin/author-applications/${submitted.id}/approve`).set({'x-client-id':String(admin.insertId),Authorization:`Bearer ${adminTokens.accessToken}`}).send({});
    expect(response.status).toBe(200);
    await application.approve(submitted.id,admin.insertId,{});
    const [[count]]:any=await pool.query('SELECT COUNT(*) AS n FROM authors WHERE user_id=? AND is_approved=1',[uid]); expect(count.n).toBe(1);
    tokens=(await access.login(email,`${password}new`)).tokens;
    const book=await request(app).post('/v1/api/authors/me/books').set(headers()).send({title:'Approved author novel',genre:'Novel',requestId:randomUUID(),status:'DRAFT'});
    expect(book.status).toBe(200); // Existing publishing API success envelope.
    expect(book.body.metadata.id).toBeGreaterThan(0);
    expect((await request(app).get('/v1/api/admin/author-applications').set(headers())).status).toBe(403);
    await pool.query('UPDATE authors SET is_approved=0 WHERE user_id=?',[uid]);
    expect((await request(app).get('/v1/api/authors/me/books').set(headers())).status).toBe(403);
    expect((await request(app).post('/v1/api/authors/me/books').set(headers()).send({title:'Unapproved',genre:'Novel',requestId:randomUUID()})).status).toBe(403);
    await pool.query('UPDATE authors SET is_approved=1 WHERE user_id=?',[uid]);
  });
  it('bounds repeated login attempts for an account even across client IP addresses',async()=>{
    app.set('trust proxy','loopback'); // Test-only: production does not trust forwarded IPs by default.
    const target=`rate-${randomUUID()}@example.invalid`;
    for(let i=0;i<11;i++){
      const response=await request(app).post('/v1/api/access/login').set('X-Forwarded-For',`192.0.2.${i+1}`).send({email:target,password});
      expect(response.status).toBe(i===10?429:401);
    }
  });
  it('cleans abandoned registrations without deleting blocked established accounts',async()=>{
    const ids:number[]=[];
    for(const hash of ['---PENDING_SETUP---','established-password-hash']){
      const [result]:any=await pool.query('INSERT INTO users(email,password_hash,state,created_at) VALUES (?,?,0,DATE_SUB(NOW(),INTERVAL 30 DAY))',[`cleanup-${randomUUID()}@example.invalid`,hash]);
      ids.push(result.insertId);
    }
    const {cleanupStaleUsers}=await import('../src/models/repositories/user.repo');
    await cleanupStaleUsers(24);
    const [remaining]:any=await pool.query('SELECT id FROM users WHERE id IN (?,?)',ids);
    expect(remaining.map((u:{id:number})=>u.id)).toEqual([ids[1]]);
  });
});
