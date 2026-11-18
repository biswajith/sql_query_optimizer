import { ExplainPlanRow, TableInfo, IndexInfo } from './database.types';

// Index recommendation
export interface IndexRecommendation {
  tableName: string;
  indexDefinition: string;
  reasoning: string;
}

/**
 * Outcome of re-running EXPLAIN on the model's final query, done by the
 * server (not the model) after the agent finishes.
 *
 * - improved:      valid query, lower estimated cost than the original
 * - not_improved:  valid query, but estimated cost is not lower
 * - no_change:     the model returned the original query
 * - unknown:       valid query, but MySQL did not report a cost to compare
 * - invalid:       the query was rejected or failed EXPLAIN
 */
export type VerificationStatus =
  | 'improved'
  | 'not_improved'
  | 'no_change'
  | 'unknown'
  | 'invalid';

// One candidate rewrite the agent ran through EXPLAIN while working
export interface OptimizationAttempt {
  query: string;
  queryCost: number | null;
  error?: string;
}

// Optimization result
export interface OptimizationResult {
  originalQuery: string;
  optimizedQuery: string;
  explainPlan: ExplainPlanRow[];
  optimizedExplainPlan?: ExplainPlanRow[];
  originalCost: number | null;
  optimizedCost: number | null;
  verification: VerificationStatus;
  verificationNote?: string;
  attempts: OptimizationAttempt[];
  tables: TableInfo[];
  indexes: IndexInfo[];
  reasoning: string;
  keyIssues?: string[];
  estimatedImprovement?: string;
  indexRecommendations?: IndexRecommendation[];
  cacheHit: boolean;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Health check response
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  services: {
    mysql: boolean;
    redis: boolean;
    /** True when a model and its credentials are configured. No model call is made. */
    llm: boolean;
  };
  timestamp: string;
}
