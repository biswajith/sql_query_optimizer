import { getLLM } from '../config/llm';
import { QueryValidationResult } from '@sql-optimizer/shared';
import { logger } from '../utils/logger';
import { getRedisClient, REDIS_TTL } from '../config/redis';
import crypto from 'crypto';

const VALIDATION_PROMPT = `You are a database security expert. Analyze the following SQL query and determine if it is safe to execute.

Query: {query}

ALLOWED QUERY TYPES (safe to execute):
1. EXPLAIN statements (e.g., EXPLAIN SELECT...)
2. SHOW CREATE TABLE statements (e.g., SHOW CREATE TABLE users)
3. SHOW INDEX statements (e.g., SHOW INDEX FROM users)
4. SELECT statements (read-only queries)

BLOCKED QUERY TYPES (reject these):
- INSERT, UPDATE, DELETE statements
- DROP, TRUNCATE, ALTER statements
- CREATE statements (tables, indexes, etc.)
- GRANT, REVOKE statements
- Any other data modification or DDL statements
- Multiple statements in one query (SQL injection risk)

Respond in JSON format ONLY:
{
  "isSafe": true/false,
  "queryType": "EXPLAIN|SHOW_CREATE_TABLE|SHOW_INDEX|SELECT|UNSAFE",
  "reason": "Brief explanation"
}

Example 1:
Query: "SELECT * FROM users WHERE id = 1"
Response: {"isSafe": true, "queryType": "SELECT", "reason": "Read-only SELECT query"}

Example 2:
Query: "DROP TABLE users"
Response: {"isSafe": false, "queryType": "UNSAFE", "reason": "DROP statement detected - data destruction risk"}

Example 3:
Query: "EXPLAIN SELECT u.name FROM users u JOIN orders o ON u.id = o.user_id"
Response: {"isSafe": true, "queryType": "EXPLAIN", "reason": "EXPLAIN statement for query analysis"}`;

function generateCacheKey(query: string): string {
  return `query_validation:${crypto.createHash('sha256').update(query.trim().toLowerCase()).digest('hex')}`;
}

export async function validateQuery(query: string): Promise<QueryValidationResult> {
  try {
    // Check cache first
    const redis = getRedisClient();
    const cacheKey = generateCacheKey(query);
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      logger.debug('Query validation cache hit');
      return JSON.parse(cached);
    }

    // Call LLM for validation
    const llm = getLLM();
    const prompt = VALIDATION_PROMPT.replace('{query}', query);
    
    logger.debug('Validating query with LLM:', query.substring(0, 100));
    const response = await llm.invoke(prompt);
    
    // Parse LLM response
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/```\n?/g, '').trim();
    }
    
    const result: QueryValidationResult = JSON.parse(jsonContent);
    
    // Validate the result structure
    if (typeof result.isSafe !== 'boolean' || !result.queryType || !result.reason) {
      throw new Error('Invalid validation response format');
    }
    
    // Cache the result
    await redis.setex(cacheKey, REDIS_TTL, JSON.stringify(result));
    
    // Log security event
    if (!result.isSafe) {
      logger.warn('UNSAFE QUERY BLOCKED:', { query, result });
    }
    
    return result;
  } catch (error) {
    // Fail-safe: reject query if validation fails
    logger.error('Query validation error:', error);
    return {
      isSafe: false,
      queryType: 'UNSAFE',
      reason: 'Validation failed - rejecting query for safety',
    };
  }
}

export async function validateAndExecute<T>(
  query: string,
  executor: () => Promise<T>
): Promise<T> {
  const validation = await validateQuery(query);
  
  if (!validation.isSafe) {
    throw new Error(`Query rejected: ${validation.reason}`);
  }
  
  return executor();
}

