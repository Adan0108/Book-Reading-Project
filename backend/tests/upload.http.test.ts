import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
const roles = vi.hoisted(() => ({ current: ['AUTHOR'] }));
// Keep HTTP authentication and real RSA verification, isolate session storage here.
vi.mock('../src/services/session.service', async () => {
  const jwt = (await import('jsonwebtoken')).default;
  return { verifySessionToken: async (token: string, uid: number, purpose: string) => {
    try {
      const payload = jwt.verify(token, signing.publicKey, { algorithms:['RS256'], issuer:'hibook', audience:'hibook-web' }) as import('../src/services/session.service').SessionPayload;
      if (payload.uid !== uid || payload.token_use !== purpose) throw new Error('Invalid token purpose');
      return payload;
    } catch { throw Object.assign(new Error('Invalid token'), {status:401}); }
  } };
});
const signing = vi.hoisted(() => require('node:crypto').generateKeyPairSync('rsa', { modulusLength:2048, publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'} }));
vi.mock('../src/models/repositories/user.repo', () => ({ getRoles: async () => roles.current }));
vi.mock('../src/dbs/init.redis', () => ({ getRedis: () => ({ get: async () => null }) }));
import router from '../src/routes/upload';
const app = express(); app.use(express.json()); app.use('/v1/api',router);
app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status ?? 500).json({ message:error.message }));
const headers = () => ({ 'x-client-id':'1',Authorization:`Bearer ${jwt.sign({ uid:1,jti:'test',sid:'test-session',token_use:'access' },signing.privateKey,{algorithm:'RS256',issuer:'hibook',audience:'hibook-web',expiresIn:'15m'})}` });
describe('protected upload HTTP endpoints',()=>{
  beforeEach(()=>{roles.current=['AUTHOR'];});
  it('requires authentication and rejects invalid tokens with 401',async()=>{
    expect((await request(app).post('/v1/api/upload/fan-art/authorize').send({})).status).toBe(401);
    expect((await request(app).post('/v1/api/upload/fan-art/authorize').set('x-client-id','1').send({})).status).toBe(401);
    expect((await request(app).post('/v1/api/upload/fan-art/authorize').set({...headers(),Authorization:'Bearer forged'}).send({})).status).toBe(401);
  });
  it('forbids readers from authorizing and confirming',async()=>{
    roles.current=['READER'];
    for(const action of ['authorize','confirm']) expect((await request(app).post(`/v1/api/upload/fan-art/${action}`).set(headers()).send({})).status).toBe(403);
  });
  it('validates metadata and rejects arbitrary public IDs at the HTTP boundary',async()=>{
    const result=await request(app).post('/v1/api/upload/fan-art/authorize').set(headers()).send({purpose:'chapter',size:10,mimeType:'image/svg+xml',bookId:10});
    expect(result.status).toBe(400);
    expect((await request(app).post('/v1/api/upload/fan-art/confirm').set(headers()).send({assetId:'foreign-public-id'})).status).toBe(400);
  });
});
