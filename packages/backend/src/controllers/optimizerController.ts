import { Request, Response, NextFunction } from 'express';
import {
  OptimizationRequest,
  OptimizationResult,
  ApiResponse,
  HealthCheckResponse,
  TableInfo,
  IndexInfo,
} from '@sql-optimizer/shared';
import { getDatabaseName, testConnection } from '../config/database';
import { testRedisConnection } from '../config/redis';
import { getChatModel, getModelName, isLLMConfigured } from '../config/llm';
import { getTableSchema, getTableIndexes, executeExplain } from '../services/mysqlService';
import {
  getCachedTableSchema,
  cacheTableSchema,
  getCachedTableIndexes,
  cacheTableIndexes,
} from '../services/redisService';
import { guardSelect } from '../services/sqlGuard';
import { runOptimizerAgent } from '../services/optimizerAgent';
import { verifyOptimization } from '../services/verification';
import { AppError, ErrorType } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

async function loadTable(
  tableName: string
): Promise<{ table: TableInfo; indexes: IndexInfo[]; cached: boolean }> {
  const [cachedTable, cachedIndexes] = await Promise.all([
    getCachedTableSchema(tableName),
    getCachedTableIndexes(tableName),
  ]);

  const table = cachedTable ?? (await getTableSchema(tableName));
  const indexes = cachedIndexes ?? (await getTableIndexes(tableName));

  if (!cachedTable) await cacheTableSchema(table);
  if (!cachedIndexes) await cacheTableIndexes(tableName, indexes);

  return { table, indexes, cached: !!cachedTable && !!cachedIndexes };
}

export async function optimizeQuery(
  req: Request,
  res: Response<ApiResponse<OptimizationResult>>,
  next: NextFunction
) {
  try {
    const { query: rawQuery, includeIndexRecommendations }: OptimizationRequest = req.body;
    const database = getDatabaseName();

    if (!isLLMConfigured()) {
      throw new AppError(
        ErrorType.LLM_ERROR,
        `No API key is configured for model "${getModelName()}"`,
        503
      );
    }

    // 1. Deterministic gate: one read-only SELECT against our database.
    const { query, tables: tableNames } = guardSelect(rawQuery, database);
    if (tableNames.length === 0) {
      throw new AppError(ErrorType.PARSE_ERROR, 'The query does not read from any table', 400);
    }
    logger.info(`Optimizing query over ${tableNames.length} table(s): ${tableNames.join(', ')}`);

    // 2. Baseline plan, plus schema and indexes (Redis-cached).
    const [explain, loaded] = await Promise.all([
      executeExplain(query),
      Promise.all(tableNames.map(loadTable)),
    ]);
    const tables = loaded.map((l) => l.table);
    const indexes = loaded.flatMap((l) => l.indexes);
    const cacheHit = loaded.every((l) => l.cached);

    // 3. Agent proposes rewrites and checks each with EXPLAIN.
    const agentOutput = await runOptimizerAgent(
      { query, explain, tables, indexes, includeIndexRecommendations },
      { model: await getChatModel(), database, explain: executeExplain }
    );

    // 4. Server-side verification of whatever the agent settled on.
    const verification = await verifyOptimization({
      originalQuery: query,
      originalCost: explain.queryCost,
      candidate: agentOutput.optimizedQuery,
      database,
      explain: executeExplain,
    });

    const result: OptimizationResult = {
      originalQuery: query,
      optimizedQuery: verification.optimizedQuery,
      explainPlan: explain.rows,
      optimizedExplainPlan: verification.optimizedExplainPlan,
      originalCost: explain.queryCost,
      optimizedCost: verification.optimizedCost,
      verification: verification.status,
      verificationNote: verification.note,
      estimatedImprovement: verification.estimatedImprovement,
      attempts: agentOutput.attempts,
      tables,
      indexes,
      reasoning: agentOutput.reasoning,
      keyIssues: agentOutput.keyIssues,
      indexRecommendations: agentOutput.indexRecommendations,
      cacheHit,
    };

    logger.info(`Optimization finished: ${verification.status}`);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function healthCheck(
  req: Request,
  res: Response<ApiResponse<HealthCheckResponse>>,
  next: NextFunction
) {
  try {
    const [mysql, redis] = await Promise.all([testConnection(), testRedisConnection()]);
    // Configuration check only: a health probe must not spend model tokens.
    const llm = isLLMConfigured();
    // Redis is a cache; the service still works (slower) without it.
    const healthy = mysql && llm;

    res.status(healthy ? 200 : 503).json({
      success: healthy,
      data: {
        status: healthy ? 'healthy' : 'unhealthy',
        services: { mysql, redis, llm },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}
