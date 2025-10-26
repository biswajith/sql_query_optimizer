import { ExplainPlanRow, TableInfo, IndexInfo } from './database.types';

// Index recommendation
export interface IndexRecommendation {
  tableName: string;
  indexDefinition: string;
  reasoning: string;
}

// Optimization result
export interface OptimizationResult {
  originalQuery: string;
  optimizedQuery: string;
  explainPlan: ExplainPlanRow[];
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
    llm: boolean;
  };
  timestamp: string;
}

