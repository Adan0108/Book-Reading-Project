// Isolated local E2E server: never uses the configured application database.
process.chdir(require('node:path').resolve(__dirname, '..'));
process.env.MYSQL_HOST = '127.0.0.1';
process.env.MYSQL_PORT = '3307';
process.env.MYSQL_USER = 'root';
process.env.MYSQL_PASSWORD = 'publishing-qa-local';
process.env.MYSQL_DB = 'publishing_qa';
process.env.PORT = '3000';
process.env.FRONTEND_URL = 'http://localhost:8000';
require('dotenv').config({ quiet: true });
const { pool } = require('../dist/dbs/init.mysql');
const { runMigrationsOnce } = require('../dist/dbs/migrate');
const bcrypt = require('bcrypt');
(async () => {
  await runMigrationsOnce();
  const hash = await bcrypt.hash('Publishing-QA-only-2026!', 10);
  await pool.query('INSERT INTO users (email,password_hash) VALUES (?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)', ['publishing-e2e@example.invalid',hash]);
  const [[u]] = await pool.query('SELECT id FROM users WHERE email=?',['publishing-e2e@example.invalid']);
  await pool.query('INSERT IGNORE INTO user_verifications (user_id,type,is_verified,expires_at) SELECT ?,\'EMAIL_OTP\',1,DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE NOT EXISTS (SELECT 1 FROM user_verifications WHERE user_id=? AND is_verified=1)',[u.id,u.id]);
  await pool.query('INSERT INTO authors (user_id,pen_name,is_approved) VALUES (?,\'Publishing Browser QA\',1) ON DUPLICATE KEY UPDATE is_approved=1',[u.id]);
  await pool.query('INSERT IGNORE INTO user_roles (user_id,role_id) SELECT ?,id FROM roles WHERE code=\'AUTHOR\'',[u.id]);
  require('../dist/server');
})().catch(error => { console.error(error.message); process.exit(1); });
