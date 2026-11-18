import { describe, expect, it, vi } from 'vitest';
import { verifyOptimization } from '../src/services/verification';

const explainWith = (queryCost: number | null) =>
  vi.fn(async () => ({ rows: [], queryCost }));

const base = { originalQuery: 'SELECT * FROM users', originalCost: 100, database: 'testdb' };

describe('verifyOptimization', () => {
  it('reports no_change without calling EXPLAIN', async () => {
    const explain = explainWith(1);
    const v = await verifyOptimization({ ...base, candidate: 'SELECT *  FROM users;', explain });
    expect(v.status).toBe('no_change');
    expect(explain).not.toHaveBeenCalled();
  });

  it('reports improved when cost drops', async () => {
    const v = await verifyOptimization({
      ...base,
      candidate: 'SELECT id FROM users',
      explain: explainWith(25),
    });
    expect(v.status).toBe('improved');
    expect(v.estimatedImprovement).toContain('-75.0%');
  });

  it('reports not_improved when cost does not drop', async () => {
    const v = await verifyOptimization({
      ...base,
      candidate: 'SELECT id FROM users',
      explain: explainWith(150),
    });
    expect(v.status).toBe('not_improved');
  });

  it('reports invalid when the model returns a non-SELECT', async () => {
    const explain = explainWith(1);
    const v = await verifyOptimization({ ...base, candidate: 'DROP TABLE users', explain });
    expect(v.status).toBe('invalid');
    expect(explain).not.toHaveBeenCalled();
  });

  it('reports unknown when MySQL gives no cost', async () => {
    const v = await verifyOptimization({
      ...base,
      candidate: 'SELECT id FROM users',
      explain: explainWith(null),
    });
    expect(v.status).toBe('unknown');
  });
});
