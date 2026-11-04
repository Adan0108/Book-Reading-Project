// Read-only reconciliation. Never deletes cloud resources or database rows.
require('dotenv').config({ quiet: true });
const { pool } = require('../dist/dbs/init.mysql');
(async () => {
  const [rows] = await pool.query(`SELECT a.id, a.public_id, a.confirmed_at, a.expires_at, a.created_at
    FROM publishing_assets a
    LEFT JOIN chapter_images ci ON ci.asset_id=a.id LEFT JOIN book_covers bc ON bc.asset_id=a.id
    WHERE ci.asset_id IS NULL AND bc.asset_id IS NULL AND a.created_at < DATE_SUB(NOW(), INTERVAL 1 DAY)
    ORDER BY a.created_at LIMIT 1000`);
  console.log(JSON.stringify({ action: 'review-only', candidates: rows }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode=1; }).finally(() => pool.end());
