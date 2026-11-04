import "dotenv/config";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../dbs/init.mysql";
import { withTransaction } from "../dbs/transaction";
// Local operator CLI only; no HTTP route or default administrator password.
export async function grantAdmin(email: string) {
  if (!email || email.length > 100 || !email.includes("@"))
    throw new Error("Supply the verified account email");
  return withTransaction(async (db) => {
    const [users] = await db.query<RowDataPacket[]>(
      `SELECT u.id FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.email=? AND u.state=1
      AND EXISTS(SELECT 1 FROM user_verifications v WHERE v.user_id=u.id AND v.is_verified=1 AND v.type='EMAIL_OTP') FOR UPDATE`,
      [email.trim().toLowerCase()],
    );
    if (!users[0])
      throw new Error(
        "An active verified account with completed profile is required",
      );
    const id = Number(users[0].id);
    await db.query(
      "INSERT IGNORE INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE code='ADMIN'",
      [id],
    );
    await db.query(
      "INSERT INTO admin_audit_logs(admin_user_id,action,target,details_json) VALUES (?,'OPERATOR_ADMIN_GRANTED',?,?)",
      [id, `user:${id}`, JSON.stringify({ source: "local operator CLI" })],
    );
    return { userId: id };
  });
}
if (require.main === module) {
  grantAdmin(process.argv[2] ?? "")
    .then((result) =>
      console.log(
        `Administrator granted to account ${result.userId}. Sign in again.`,
      ),
    )
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
