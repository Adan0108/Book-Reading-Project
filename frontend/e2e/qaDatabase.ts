import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// Only this fixed, isolated fixture is permitted; no normal .env values are read.
export async function qaDatabase() {
  const mysql = require("../../backend/node_modules/mysql2/promise");
  return mysql.createConnection({
    host: "127.0.0.1",
    port: 3307,
    user: "root",
    password: "publishing-qa-local",
    database: "publishing_qa",
  });
}
export async function qaPasswordHash(password: string): Promise<string> {
  return require("../../backend/node_modules/bcrypt").hash(password, 10);
}
