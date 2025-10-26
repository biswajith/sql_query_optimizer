import { Request, Response, NextFunction } from 'express';
import { OptimizationRequest, OptimizationResult, ApiResponse } from '@sql-optimizer/shared';
import { extractTableNames } from '../services/queryAnalyzer';
import { getTableSchema, getTableIndexes, executeExplain } from '../services/mysqlService';
import { getCachedTableSchema, cacheTableSchema, getCachedTableIndexes, cacheTableIndexes } from '../services/redisService';
import { getQueryOptimization } from '../services/llmService';
import { validateQuery } from '../services/queryValidator';
import { AppError, ErrorType } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export async function optimizeQuery(
  req: Request,
  res: Response<ApiResponse<OptimizationResult>>,
  next: NextFunction
) {
  try {
    const { query, includeIndexRecommendations }: OptimizationRequest = req.body;
    
    logger.info('Starting query optimization', { includeIndexRecommendations });
    
    // Step 1: Validate user's query
    const queryValidation = await validateQuery(query);
    if (!queryValidation.isSafe) {
      throw new AppError(
        ErrorType.SECURITY_ERROR,
        `Query rejected for security reasons: ${queryValidation.reason}`,
        403
      );
    }
    
    // Step 2: Extract table names from query
    const tableNames = await extractTableNames(query);
    
    if (tableNames.length === 0) {
      throw new AppError(
        ErrorType.PARSE_ERROR,
        'No tables found in query',
        400
      );
    }
    
    logger.info(`Found ${tableNames.length} tables:`, tableNames);
    
    // Step 3: Fetch table schemas (with caching)
    let cacheHit = true;
    const tableInfoPromises = tableNames.map(async (tableName) => {
      let tableInfo = await getCachedTableSchema(tableName);
      
      if (!tableInfo) {
        cacheHit = false;
        tableInfo = await getTableSchema(tableName);
        await cacheTableSchema(tableInfo);
      }
      
      return tableInfo;
    });
    
    const tables = await Promise.all(tableInfoPromises);
    
    // Step 4: Fetch index information (with caching)
    const indexPromises = tableNames.map(async (tableName) => {
      let indexes = await getCachedTableIndexes(tableName);
      
      if (!indexes) {
        cacheHit = false;
        indexes = await getTableIndexes(tableName);
        await cacheTableIndexes(tableName, indexes);
      }
      
      return indexes;
    });
    
    const indexArrays = await Promise.all(indexPromises);
    const indexes = indexArrays.flat();
    
    // Step 5: Execute EXPLAIN plan
    const explainPlan = await executeExplain(query);
    
    // Step 6: Get optimization suggestions from LLM
    const optimization = await getQueryOptimization({
      query,
      explainPlan,
      tables,
      indexes,
      includeIndexRecommendations,
    });
    
    // Step 7: Build response
    const result: OptimizationResult = {
      originalQuery: query,
      optimizedQuery: optimization.optimizedQuery,
      explainPlan,
      tables,
      indexes,
      reasoning: optimization.reasoning,
      keyIssues: optimization.keyIssues,
      estimatedImprovement: optimization.estimatedImprovement,
      indexRecommendations: optimization.indexRecommendations,
      cacheHit,
    };
    
    logger.info('Query optimization completed successfully');
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function healthCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const { testConnection } = await import('../config/database');
    const { testRedisConnection } = await import('../config/redis');
    const { testLLMConnection } = await import('../config/llm');
    
    const [mysql, redis, llm] = await Promise.all([
      testConnection(),
      testRedisConnection(),
      testLLMConnection(),
    ]);
    
    const allHealthy = mysql && redis && llm;
    
    res.status(allHealthy ? 200 : 503).json({
      success: allHealthy,
      data: {
        status: allHealthy ? 'healthy' : 'unhealthy',
        services: { mysql, redis, llm },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

