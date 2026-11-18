import { ExplainPlanRow, VerificationStatus } from '@sql-optimizer/shared';
import { AppError } from '../middleware/errorHandler';
import { guardSelect } from './sqlGuard';
import type { ExplainResult } from './mysqlService';

export interface Verification {
  status: VerificationStatus;
  note?: string;
  optimizedQuery: string;
  optimizedCost: number | null;
  optimizedExplainPlan?: ExplainPlanRow[];
  estimatedImprovement?: string;
}

function normalize(sql: string): string {
  return sql.trim().replace(/;\s*$/, '').replace(/\s+/g, ' ');
}

/**
 * Independently check the model's final query: it must pass the same guard
 * as user input and EXPLAIN cleanly, and its estimated cost is compared with
 * the original's. This does not prove the two queries return the same rows.
 */
export async function verifyOptimization(params: {
  originalQuery: string;
  originalCost: number | null;
  candidate: string;
  database: string;
  explain: (guardedQuery: string) => Promise<ExplainResult>;
}): Promise<Verification> {
  const { originalQuery, originalCost, candidate, database, explain } = params;

  if (normalize(candidate) === normalize(originalQuery)) {
    return {
      status: 'no_change',
      note: 'No rewrite beat the original query.',
      optimizedQuery: originalQuery,
      optimizedCost: originalCost,
    };
  }

  let result: ExplainResult;
  let guardedQuery: string;
  try {
    guardedQuery = guardSelect(candidate, database).query;
    result = await explain(guardedQuery);
  } catch (error) {
    return {
      status: 'invalid',
      note: `The suggested query failed verification: ${
        error instanceof AppError ? error.message : 'EXPLAIN failed'
      }`,
      optimizedQuery: candidate,
      optimizedCost: null,
    };
  }

  const base = {
    optimizedQuery: guardedQuery,
    optimizedCost: result.queryCost,
    optimizedExplainPlan: result.rows,
  };

  if (originalCost === null || result.queryCost === null) {
    return {
      ...base,
      status: 'unknown',
      note: 'The suggested query is valid, but MySQL reported no cost estimate to compare.',
    };
  }

  const change =
    originalCost > 0 ? ((result.queryCost - originalCost) / originalCost) * 100 : 0;
  const estimatedImprovement = `Estimated cost ${originalCost.toFixed(2)} → ${result.queryCost.toFixed(
    2
  )} (${change <= 0 ? '' : '+'}${change.toFixed(1)}%)`;

  if (result.queryCost < originalCost) {
    return { ...base, status: 'improved', estimatedImprovement };
  }

  return {
    ...base,
    status: 'not_improved',
    estimatedImprovement,
    note: 'The suggested query is valid, but its estimated cost is not lower than the original.',
  };
}
