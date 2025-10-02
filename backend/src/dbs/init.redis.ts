import "dotenv/config";
import { createClient } from "redis";
import { RedisErrorResponse } from "../core/error.response";

const { REDIS_HOST = "localhost", REDIS_PORT = "6379" } = process.env;

type RedisClient = ReturnType<typeof createClient>;
type RedisHolder = { instance?: RedisClient };

const holder: RedisHolder = {};
const STATUS = {
  CONNECT: "connect",
  READY: "ready",
  END: "end",
  RECONNECT: "reconnecting",
  ERROR: "error",
} as const;

const REDIS_CONNECT_TIMEOUT = 10_000;
const REDIS_CONNECT_MESSAGE = {
  code: -99,
  message: { vn: "Redis lỗi rồi", en: "Redis Service connection error" },
};

let connectionTimeout: NodeJS.Timeout | undefined;

const handleTimeoutError = () => {
  connectionTimeout = setTimeout(() => {
    throw new RedisErrorResponse(
      REDIS_CONNECT_MESSAGE.message.vn,
      REDIS_CONNECT_MESSAGE.code
    );
  }, REDIS_CONNECT_TIMEOUT);
};

const attachEvents = (client: RedisClient) => {
  client.on(STATUS.CONNECT, () => console.log("[Redis] connecting…"));

  client.on(STATUS.READY, () => {
    console.log("[Redis] ready");
    if (connectionTimeout) clearTimeout(connectionTimeout);
  });

  client.on(STATUS.END, () => {
    console.log("[Redis] disconnected");
    handleTimeoutError();
  });

  client.on(STATUS.RECONNECT as any, () => {
    console.log("[Redis] reconnecting…");
    if (connectionTimeout) clearTimeout(connectionTimeout);
  });

  client.on(STATUS.ERROR, (err) => {
    console.error("[Redis] error:", err);
    handleTimeoutError();
  });
};

export async function initRedis(): Promise<RedisClient> {
  const client = createClient({ url: `redis://${REDIS_HOST}:${REDIS_PORT}` });
  attachEvents(client);
  try {
    handleTimeoutError();
    await client.connect();
    if (connectionTimeout) clearTimeout(connectionTimeout);
    console.log("[Redis] connection established");
    holder.instance = client;
    return client;
  } catch (err) {
    console.error("[Redis] connection failed:", err);
    throw err;
  }
}

export function getRedis(): RedisClient | undefined {
  return holder.instance;
}

export async function closeRedis() {
  if (holder.instance) {
    await holder.instance.quit();
    console.log("[Redis] connection closed");
    holder.instance = undefined;
  }
}
