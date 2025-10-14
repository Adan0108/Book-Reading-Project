
import { pool } from '../../dbs/init.mysql';
import { ResultSetHeader } from 'mysql2';

export const findByEmail = async (email: string) => {
  const [rows]: any[] = await pool.query(
    "SELECT u.id, u.email, u.password_hash, u.status, up.username FROM users u LEFT JOIN user_profiles up ON u.id = up.user_id WHERE u.email = ?",
    [email]
  );
  return rows[0];
};

export const createUser = async ({ email, passwordHash, username }: { email: string; passwordHash: string; username: string; }) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Create user in `users` table
    const [userResult] = await connection.query<ResultSetHeader>(
      // The status will default to 'UNVERIFIED' automatically
      'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      [email, passwordHash]
    );
    const userId = userResult.insertId;

    // 2. Create profile in `user_profiles` table
    await connection.query(
      'INSERT INTO user_profiles (user_id, username) VALUES (?, ?)',
      [userId, username]
    );

    // 3. Assign default 'READER' role
    // Assuming role ID 1 is 'READER' from your seed script
    await connection.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES (?, (SELECT id FROM roles WHERE code = ?))',
      [userId, 'READER']
    );

    await connection.commit();
    return userId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const updateUserStatus = async ({ userId, status }: { userId: number; status: 'ACTIVE' | 'BLOCKED' }) => {
  await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
};

export const markOtpAsVerified = async ({ userId, otpType }: { userId: number; otpType: 'EMAIL_OTP' | 'RESET' }) => {
  await pool.query(
    'UPDATE user_verifications SET is_verified = 1 WHERE user_id = ? AND type = ? AND is_verified = 0 ORDER BY created_at DESC LIMIT 1',
    [userId, otpType]
  );
};

export const findById = async (userId: string | number) => {
  const [rows]: any[] = await pool.query(
    'SELECT id, email, state FROM users WHERE id = ?',
    [userId]
  );
  return rows[0];
};

export const updatePassword = async ({ userId, newPasswordHash }: { userId: number; newPasswordHash: string; }) => {
  const [result] = await pool.query(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [newPasswordHash, userId]
  );
  return result;
};