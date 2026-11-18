import { z } from 'zod';

// Request types
export const OptimizationRequestSchema = z.object({
  query: z.string().trim().min(1).max(10000),
  includeIndexRecommendations: z.boolean().default(false),
});

export type OptimizationRequest = z.infer<typeof OptimizationRequestSchema>;
