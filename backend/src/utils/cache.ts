import { getRedis } from "../dbs/init.redis";
const cacheClient = () => getRedis()?.withAbortSignal(AbortSignal.timeout(750));
// These helpers serve descriptive content only. Authentication, rates and financial
// state must never use this fail-open cache abstraction.
export async function cacheGet(key: string): Promise<string | null> {
  try {
    return (await cacheClient()?.get(key)) ?? null;
  } catch {
    return null;
  }
}
export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds?: number,
) {
  try {
    const redis = cacheClient();
    if (redis)
      await redis.set(
        key,
        value,
        ttlSeconds && ttlSeconds > 0 ? { EX: ttlSeconds } : undefined,
      );
  } catch {
    /* SQL remains authoritative */
  }
}
export async function cacheDel(key: string) {
  try {
    await cacheClient()?.del(key);
  } catch {
    /* bounded TTL remains the fallback */
  }
}
export async function cacheIncr(key: string) {
  try {
    await cacheClient()?.incr(key);
  } catch {
    /* non-authoritative diagnostic only */
  }
}
export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const raw = await cacheGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
export async function cacheSetJson(
  key: string,
  data: unknown,
  ttlSeconds?: number,
) {
  await cacheSet(key, JSON.stringify(data), ttlSeconds);
}
export async function cacheAside<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGetJson<T>(key);
  if (cached !== null) return cached;
  const fresh = await loader();
  await cacheSetJson(key, fresh, ttlSeconds);
  return fresh;
}
export async function cacheSetNx(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<boolean> {
  if (!ttlSeconds || ttlSeconds <= 0) throw new Error("ttlSeconds must be > 0");
  try {
    return (
      (await cacheClient()?.set(key, value, { NX: true, EX: ttlSeconds })) ===
      "OK"
    );
  } catch {
    return false;
  }
}
