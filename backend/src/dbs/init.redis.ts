import "dotenv/config";
import { createClient } from "redis";
import { ErrorResponse } from "../core/error.response";
type Client = ReturnType<typeof createClient>;
let instance: Client | undefined, initializing: Promise<Client> | undefined;
export function redisReady() {
  return Boolean(instance?.isReady);
}
export async function initRedis(): Promise<Client> {
  if (instance?.isReady) return instance;
  if (initializing) return initializing;
  let wasReady = false;
  const client = createClient({
    url:
      process.env.REDIS_URL ||
      `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}`,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: (attempts) =>
        !wasReady && attempts > 5
          ? new Error("Redis reconnect limit reached")
          : Math.min(200 * 2 ** attempts, 3000),
    },
  });
  // Do not throw from an event/timer: readiness and command failures drive availability.
  client.on("error", () => console.error("[Redis] connection unavailable"));
  client.on("ready", () => {
    wasReady = true;
    console.log("[Redis] ready");
  });
  instance = client;
  initializing = client
    .connect()
    .then(() => client)
    .catch((error) => {
      if (client.isOpen) client.destroy();
      if (instance === client) instance = undefined;
      throw error;
    })
    .finally(() => {
      initializing = undefined;
    });
  return initializing;
}
export function getRedis(): Client | undefined {
  return instance?.isReady ? instance : undefined;
}
export async function securityRedis<T>(
  command: (client: Client) => Promise<T>,
): Promise<T> {
  const client = getRedis();
  if (!client)
    throw new ErrorResponse("Security service temporarily unavailable", 503);
  try {
    return await command(client.withAbortSignal(AbortSignal.timeout(3000)));
  } catch {
    throw new ErrorResponse("Security service temporarily unavailable", 503);
  }
}
export async function closeRedis() {
  const client = instance;
  instance = undefined;
  if (client?.isOpen) {
    if (client.isReady) await client.quit();
    else client.destroy();
  }
}
