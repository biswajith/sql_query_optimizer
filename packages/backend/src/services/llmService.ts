import { getLLM } from '../config/llm';
import { ExplainPlanRow, TableInfo, IndexInfo, IndexRecommendation } from '@sql-optimizer/shared';
import { logger } from '../utils/logger';

interface OptimizationContext {
  query: string;
  explainPlan: ExplainPlanRow[];
  tables: TableInfo[];
  indexes: IndexInfo[];
  includeIndexRecommendations: boolean;
}

interface LLMOptimizationResponse {
  optimizedQuery: string;
  reasoning: string;
  keyIssues?: string[];
  estimatedImprovement?: string;
  indexRecommendations?: IndexRecommendation[];
}

function buildOptimizationPrompt(context: OptimizationContext): string {
  const { query, explainPlan, tables, indexes, includeIndexRecommendations } = context;
  
  const indexInstructions = includeIndexRecommendations
    ? `4. You MAY suggest creating new indexes if they would significantly improve performance
5. Focus on query rewriting, join order, subquery optimization, and index recommendations`
    : `4. Do NOT suggest creating new indexes (production environment)
5. Focus on query rewriting, join order, subquery optimization, etc.`;

  const responseFormat = includeIndexRecommendations
    ? `{
  "optimizedQuery": "...",
  "reasoning": "...",
  "keyIssues": ["..."],
  "estimatedImprovement": "...",
  "indexRecommendations": [
    {
      "tableName": "...",
      "indexDefinition": "CREATE INDEX idx_name ON table(column)",
      "reasoning": "..."
    }
  ]
}`
    : `{
  "optimizedQuery": "...",
  "reasoning": "...",
  "keyIssues": ["..."],
  "estimatedImprovement": "..."
}`;

  return `You are a senior database performance engineer. Analyze the following SQL query and suggest optimizations.

ORIGINAL QUERY:
${query}

EXPLAIN PLAN:
${JSON.stringify(explainPlan, null, 2)}

TABLE SCHEMAS:
${tables.map(t => `Table: ${t.tableName}\n${t.createStatement}\n`).join('\n')}

INDEX INFORMATION:
${JSON.stringify(indexes, null, 2)}

INSTRUCTIONS:
1. Analyze the query performance based on the EXPLAIN plan
2. Identify potential bottlenecks (full table scans, large row counts, etc.)
3. Suggest an optimized version of the query
${indexInstructions}

Respond in JSON format:
${responseFormat}`;
}

export async function getQueryOptimization(
  context: OptimizationContext
): Promise<LLMOptimizationResponse> {
  try {
    const llm = getLLM();
    const prompt = buildOptimizationPrompt(context);
    
    logger.debug('Requesting query optimization from LLM');
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
    
    const result: LLMOptimizationResponse = JSON.parse(jsonContent);
    
    // Validate required fields
    if (!result.optimizedQuery || !result.reasoning) {
      throw new Error('Invalid optimization response format');
    }
    
    logger.info('Query optimization completed successfully');
    
    return result;
  } catch (error) {
    logger.error('Query optimization failed:', error);
    
    // Return a fallback response
    return {
      optimizedQuery: context.query,
      reasoning: 'Unable to generate optimization suggestions. Please try again or check your query syntax.',
      keyIssues: ['Optimization service unavailable'],
      estimatedImprovement: 'Unknown',
    };
  }
}

