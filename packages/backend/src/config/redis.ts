import Redis from 'ioredis';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      // Redis is only a cache here: when it is down, fail fast so requests
      // fall through to MySQL instead of queueing behind reconnect attempts.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error:', err.message);
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });
  }
  return redisClient;
}

export async function testRedisConnection(): Promise<boolean> {
  try {
    const pong = await getRedisClient().ping();
    return pong === 'PONG';
  } catch (error) {
    logger.error('Redis connection test failed:', error);
    return false;
  }
}

export const REDIS_TTL = parseInt(process.env.REDIS_TTL || '3600');
