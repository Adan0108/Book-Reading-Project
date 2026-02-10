import { getRedis } from '../dbs/init.redis'; 
import { RedisErrorResponse } from '../core/error.response';

const REDIS_NOT_READY = {
  code: -98,
  message: { vn: 'Redis chưa sẵn sàng', en: 'Redis client not initialized' },
};

function mustRedis() {
  const client = getRedis();
  if (!client) {
    throw new RedisErrorResponse(REDIS_NOT_READY.message.vn, REDIS_NOT_READY.code);
  }
  return client;
}

// Basic key ops
export async function cacheGet(key: string): Promise<string | null> {
  const redis = mustRedis();
  return redis.get(key);
}

export async function cacheSet(key: string, value: string, ttlSeconds?: number) {
  const redis = mustRedis();

  if (ttlSeconds && ttlSeconds > 0) {
    await redis.set(key, value, { EX: ttlSeconds });
    return;
  }

  await redis.set(key, value);
}

export async function cacheDel(key: string) {
  const redis = mustRedis();
  await redis.del(key);
}

export const cacheIncr = async (key: string) => {
  const redis = mustRedis();
  await redis.incr(key);
};

// JSON helpers
export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const raw = await cacheGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null; 
  }
}

export async function cacheSetJson(key: string, data: any, ttlSeconds?: number) {
  await cacheSet(key, JSON.stringify(data), ttlSeconds);
}

export async function cacheAside<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const cached = await cacheGetJson<T>(key);
  if (cached !== null) return cached;

  const fresh = await loader();
  await cacheSetJson(key, fresh, ttlSeconds);
  return fresh;
}

export async function cacheSetNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const redis = mustRedis();
  if (!ttlSeconds || ttlSeconds <= 0) throw new Error('ttlSeconds must be > 0');

  const res = await redis.set(key, value, { NX: true, EX: ttlSeconds });
  return res === 'OK'; // OK = set success, null = already exists
}
