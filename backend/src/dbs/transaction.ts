import type { PoolConnection } from 'mysql2/promise';
import { pool } from './init.mysql';

export async function withTransaction<T>(work: (db: PoolConnection) => Promise<T>): Promise<T> {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const result = await work(db);
    await db.commit();
    return result;
  } catch (error) { await db.rollback(); throw error; }
  finally { db.release(); }
}
