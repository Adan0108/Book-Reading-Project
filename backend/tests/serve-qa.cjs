// Isolated local E2E server: never uses the configured application database.
process.chdir(require('node:path').resolve(__dirname, '..'));
process.env.MYSQL_HOST = '127.0.0.1';
process.env.MYSQL_PORT = '3307';
process.env.MYSQL_USER = 'root';
process.env.MYSQL_PASSWORD = 'publishing-qa-local';
process.env.MYSQL_DB = 'publishing_qa';
process.env.PORT = '3000';
process.env.NODE_ENV='test';
process.env.FRONTEND_URL = 'http://localhost:8000';
// Always isolate email as well as the database, regardless of local .env values.
process.env.EMAIL_HOST='127.0.0.1'; process.env.EMAIL_PORT='2526'; process.env.EMAIL_SECURE='false';
process.env.EMAIL_USER=''; process.env.EMAIL_PASSWORD=''; process.env.EMAIL_FROM='qa@example.invalid';
require('dotenv').config({ quiet: true });
const { pool } = require('../dist/dbs/init.mysql');
const { runMigrationsOnce } = require('../dist/dbs/migrate');
const bcrypt = require('bcrypt');
(async () => {
  await require('./local-mailbox.cjs').startMailbox();
  await runMigrationsOnce();
  const hash = await bcrypt.hash('Publishing-QA-only-2026!', 10);
  await pool.query('INSERT INTO users (email,password_hash) VALUES (?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)', ['publishing-e2e@example.invalid',hash]);
  const [[u]] = await pool.query('SELECT id FROM users WHERE email=?',['publishing-e2e@example.invalid']);
  await pool.query('INSERT IGNORE INTO user_verifications (user_id,type,is_verified,expires_at) SELECT ?,\'EMAIL_OTP\',1,DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE NOT EXISTS (SELECT 1 FROM user_verifications WHERE user_id=? AND is_verified=1)',[u.id,u.id]);
  await pool.query('INSERT INTO authors (user_id,pen_name,is_approved) VALUES (?,\'Publishing Browser QA\',1) ON DUPLICATE KEY UPDATE is_approved=1',[u.id]);
  await pool.query('INSERT IGNORE INTO user_roles (user_id,role_id) SELECT ?,id FROM roles WHERE code=\'AUTHOR\'',[u.id]);
  await pool.query('INSERT INTO users (email,password_hash,state) VALUES (?,?,1) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash),state=1',['admin-e2e@example.invalid',hash]);
  const [[admin]]=await pool.query('SELECT id FROM users WHERE email=?',['admin-e2e@example.invalid']);
  await pool.query("INSERT IGNORE INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE code='ADMIN'",[admin.id]);
  if(process.env.PAYMENT_QA_FIXTURE==='1') {
    if(process.env.NODE_ENV!=='test'||process.env.MYSQL_DB!=='publishing_qa'||process.env.MYSQL_PORT!=='3307') throw new Error('Payment fixture requires isolated QA');
    const express=require('express');
    const fixture=require('./payment-fixture.cjs').createFixtureProvider();
    const qa=express();
    qa.get('/__qa/checkout/:id',(req,res)=>{
      const q=fixture.sessions.get(req.params.id);
      if(!q)return res.status(404).send('Unknown payment fixture');
      res.setHeader('Cache-Control','no-store');
      res.type('html').send(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>HiBook payment test simulation</title><body style="font:18px system-ui;max-width:40rem;margin:3rem auto;padding:1rem"><h1>Payment test simulation</h1><p>No real transaction. Local provider fixture only.</p><p>${q.kind==='MEMBERSHIP'?'Monthly membership':'One-time donation'}: USD ${(q.cents/100).toFixed(2)}</p><form method="post"><button style="padding:1rem" type="submit">Confirm fixture payment</button></form></body></html>`);
    });
    qa.post('/__qa/checkout/:id',async(req,res,next)=>{try{
      const q=fixture.sessions.get(req.params.id);if(!q)return res.status(404).send('Unknown payment fixture');
      const now=Math.floor(Date.now()/1000),subId=`sub_fixture_${q.id}`;
      if(q.kind==='MEMBERSHIP')fixture.subscriptions.set(subId,{id:subId,intentId:q.id,status:'active',autoRenew:true});
      const update={kind:'PAID',intentId:q.id,paymentId:`${q.kind==='MEMBERSHIP'?'in':'cs'}_fixture_${q.id}`,paymentIntentId:`pi_fixture_${q.id}`,cents:q.cents,currency:'usd',...(q.kind==='MEMBERSHIP'?{subscriptionId:subId,start:now,end:now+30*86400}:{})};
      const e=fixture.event(update);
      const delivery=await fetch('http://127.0.0.1:3000/v1/api/payments/stripe/webhook',{method:'POST',headers:{'Content-Type':'application/json','stripe-signature':e.signature},body:e.raw});
      if(!delivery.ok)throw new Error(`Fixture webhook failed: ${delivery.status}`);
      res.redirect(303,`${q.returnUrl}?checkout=${q.id}`);
    }catch(e){next(e);}});
    qa.use(require('../dist/app').createHttpApp(fixture));
    qa.listen(3000,'127.0.0.1',()=>console.log('QA fixture API listening on localhost:3000'));
  } else require('../dist/server');
})().catch(error => { console.error(error.message); process.exit(1); });
