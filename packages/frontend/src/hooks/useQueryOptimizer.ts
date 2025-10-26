import { useState } from 'react';
import type { OptimizationResult } from '@sql-optimizer/shared';
import { optimizeQuery } from '../services/api';

interface UseQueryOptimizerReturn {
  result: OptimizationResult | null;
  loading: boolean;
  error: string | null;
  optimize: (query: string, includeIndexRecommendations: boolean) => Promise<void>;
  reset: () => void;
}

export function useQueryOptimizer(): UseQueryOptimizerReturn {
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optimize = async (query: string, includeIndexRecommendations: boolean) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await optimizeQuery({ query, includeIndexRecommendations });
      setResult(data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'An error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return { result, loading, error, optimize, reset };
}

