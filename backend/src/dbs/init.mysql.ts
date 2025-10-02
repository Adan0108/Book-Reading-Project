import "dotenv/config";
import mysql from "mysql2/promise";

const {
  MYSQL_HOST = "localhost",
  MYSQL_PORT = "3306",
  MYSQL_USER = "user",
  MYSQL_PASSWORD = "password",
  MYSQL_DB = "mydb",
} = process.env;

export const pool = mysql.createPool({
  host: MYSQL_HOST,
  port: Number(MYSQL_PORT),
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DB,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/** Kết nối thử để báo OK khi boot */
export async function pingMySQL(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    console.log("[MySQL] ping OK");
  } finally {
    conn.release();
  }
}

/** Đóng pool khi tắt server */
export async function closeMySQL(): Promise<void> {
  await pool.end();
  console.log("[MySQL] pool closed");
}
