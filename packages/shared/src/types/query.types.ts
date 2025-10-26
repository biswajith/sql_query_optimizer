import { z } from 'zod';

// Request types
export const OptimizationRequestSchema = z.object({
  query: z.string().min(1).max(10000),
  includeIndexRecommendations: z.boolean().default(false),
});

export type OptimizationRequest = z.infer<typeof OptimizationRequestSchema>;

// Query validation types
export interface QueryValidationResult {
  isSafe: boolean;
  queryType: 'EXPLAIN' | 'SHOW_CREATE_TABLE' | 'SHOW_INDEX' | 'SELECT' | 'UNSAFE';
  reason: string;
}

