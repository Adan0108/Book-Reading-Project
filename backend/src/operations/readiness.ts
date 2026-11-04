import { pool } from "../dbs/init.mysql";
import { getRedis } from "../dbs/init.redis";
let schemaReady = false,
  draining = false;
export function markSchemaReady() {
  schemaReady = true;
}
export function markDraining() {
  draining = true;
}
export async function readiness() {
  let database = false,
    redis = false;
  await Promise.allSettled([
    (async () => {
      let deadline: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          pool.query({ sql: "SELECT 1", timeout: 2000 }),
          new Promise((_, reject) => {
            deadline = setTimeout(
              () => reject(new Error("Readiness timeout")),
              2000,
            );
          }),
        ]);
        database = true;
      } finally {
        clearTimeout(deadline);
      }
    })(),
    (async () => {
      const client = getRedis();
      if (client)
        redis =
          (await client.withAbortSignal(AbortSignal.timeout(1000)).ping()) ===
          "PONG";
    })(),
  ]);
  return {
    ready: schemaReady && !draining && database && redis,
    database,
    redis,
    schema: schemaReady,
    draining,
  };
}
