import { getRedisClient, REDIS_TTL } from '../config/redis';
import { TableInfo, IndexInfo } from '@sql-optimizer/shared';
import { logger } from '../utils/logger';

const CACHE_PREFIX = {
  TABLE_SCHEMA: 'table_schema',
  TABLE_INDEXES: 'table_indexes',
};

function getDatabaseName(): string {
  return process.env.MYSQL_DATABASE || 'default';
}

function buildCacheKey(prefix: string, tableName: string): string {
  const dbName = getDatabaseName();
  return `${prefix}:${dbName}:${tableName}`;
}

export async function getCachedTableSchema(tableName: string): Promise<TableInfo | null> {
  try {
    const redis = getRedisClient();
    const key = buildCacheKey(CACHE_PREFIX.TABLE_SCHEMA, tableName);
    const cached = await redis.get(key);
    
    if (cached) {
      logger.debug(`Cache HIT for table schema: ${tableName}`);
      return JSON.parse(cached);
    }
    
    logger.debug(`Cache MISS for table schema: ${tableName}`);
    return null;
  } catch (error) {
    logger.error('Redis get error:', error);
    return null;
  }
}

export async function cacheTableSchema(tableInfo: TableInfo): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = buildCacheKey(CACHE_PREFIX.TABLE_SCHEMA, tableInfo.tableName);
    await redis.setex(key, REDIS_TTL, JSON.stringify(tableInfo));
    logger.debug(`Cached table schema: ${tableInfo.tableName}`);
  } catch (error) {
    logger.error('Redis set error:', error);
  }
}

export async function getCachedTableIndexes(tableName: string): Promise<IndexInfo[] | null> {
  try {
    const redis = getRedisClient();
    const key = buildCacheKey(CACHE_PREFIX.TABLE_INDEXES, tableName);
    const cached = await redis.get(key);
    
    if (cached) {
      logger.debug(`Cache HIT for table indexes: ${tableName}`);
      return JSON.parse(cached);
    }
    
    logger.debug(`Cache MISS for table indexes: ${tableName}`);
    return null;
  } catch (error) {
    logger.error('Redis get error:', error);
    return null;
  }
}

export async function cacheTableIndexes(tableName: string, indexes: IndexInfo[]): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = buildCacheKey(CACHE_PREFIX.TABLE_INDEXES, tableName);
    await redis.setex(key, REDIS_TTL, JSON.stringify(indexes));
    logger.debug(`Cached table indexes: ${tableName}`);
  } catch (error) {
    logger.error('Redis set error:', error);
  }
}

export async function invalidateTableCache(tableName: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const schemaKey = buildCacheKey(CACHE_PREFIX.TABLE_SCHEMA, tableName);
    const indexKey = buildCacheKey(CACHE_PREFIX.TABLE_INDEXES, tableName);
    
    await Promise.all([
      redis.del(schemaKey),
      redis.del(indexKey),
    ]);
    
    logger.info(`Invalidated cache for table: ${tableName}`);
  } catch (error) {
    logger.error('Redis delete error:', error);
  }
}

