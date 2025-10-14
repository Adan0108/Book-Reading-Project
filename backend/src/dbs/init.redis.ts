// src/dbs/init.redis.ts
import 'dotenv/config';
import { createClient } from 'redis';
import { RedisErrorResponse } from '../core/error.response';

const { REDIS_HOST = 'localhost', REDIS_PORT = '6379' } = process.env;

// Use a class to manage the Redis client instance (Singleton pattern)
class RedisService {
  private static instance: RedisService;
  private client: ReturnType<typeof createClient>;
  private status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' = 'disconnected';

  private constructor() {
    this.client = createClient({
      url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
      // Add a retry strategy for reconnections
      socket: {
        reconnectStrategy: (retries) => {
          // Exponential backoff: wait 100ms, then 200ms, 400ms, etc., up to 1 second
          return Math.min(retries * 100, 1000);
        }
      }
    });

    this.client.on('connect', () => {
      this.status = 'connecting';
      console.log('[Redis] connecting…');
    });

    this.client.on('ready', () => {
      this.status = 'connected';
      console.log('[Redis] ready');
    });

    this.client.on('reconnecting', () => {
      this.status = 'reconnecting';
      console.log('[Redis] reconnecting…');
    });

    // This is the key change: a simple disconnect is not a fatal error
    this.client.on('end', () => {
      this.status = 'disconnected';
      console.log('[Redis] disconnected');
    });

    this.client.on('error', (err) => {
      console.error('[Redis] client error:', err);
      // We don't crash the app here; the retry strategy will handle it.
    });
  }

  static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  getClient() {
    if (this.status !== 'connected') {
        // You might want to handle this case, but for now, we rely on the client's internal buffer
    }
    return this.client;
  }

  async connect(): Promise<void> {
    if (this.status === 'connected' || this.status === 'connecting') {
      return;
    }
    try {
      await this.client.connect();
    } catch (err) {
      console.error('[Redis] Failed to connect on startup:', err);
      throw new RedisErrorResponse('Redis Service connection error on startup', -99);
    }
  }

  async quit(): Promise<void> {
    await this.client.quit();
  }
}

// Export a single instance to be used throughout the app
export const redisService = RedisService.getInstance();