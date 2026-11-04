import "dotenv/config";
import { createServer } from "node:http";
import app from "./app";
import { attachChat } from "./chat/chat.socket";
import { pingMySQL, closeMySQL } from "./dbs/init.mysql";
import { initRedis, closeRedis } from "./dbs/init.redis";
import { runMigrationsOnce } from "./dbs/migrate";
import { markSchemaReady, markDraining } from "./operations/readiness";
import { runUserCleanup } from "./services/cleanup.service";
async function start() {
  await pingMySQL();
  await runMigrationsOnce({
    apply:
      process.env.MIGRATIONS_AUTO_APPLY === "true" ||
      (process.env.MIGRATIONS_AUTO_APPLY === undefined &&
        process.env.NODE_ENV !== "production"),
  });
  markSchemaReady();
  await initRedis();
  const server = createServer(app),
    chat = attachChat(server);
  const cleanup = setInterval(() => void runUserCleanup(), 86400000);
  cleanup.unref();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(Number(process.env.PORT || 3000), "0.0.0.0", () => {
      server.off("error", reject);
      resolve();
    });
  });
  console.log(`[HTTP] listening on ${process.env.PORT || 3000}`);
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    markDraining();
    clearInterval(cleanup);
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    await new Promise<void>((resolve) => chat.close(() => resolve()));
    await Promise.allSettled([closeRedis(), closeMySQL()]);
    clearTimeout(deadline);
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
}
start().catch(async (error) => {
  console.error(`[startup] ${error.message}`);
  await Promise.allSettled([closeRedis(), closeMySQL()]);
  process.exitCode = 1;
});
