import { describe, expect, it, vi } from 'vitest';
import { FakeToolCallingModel } from 'langchain';
import { runOptimizerAgent } from '../src/services/optimizerAgent';

const input = {
  query: 'SELECT * FROM users WHERE id IN (SELECT user_id FROM orders)',
  explain: { rows: [], queryCost: 100 },
  tables: [{ tableName: 'users', createStatement: 'CREATE TABLE users (id INT)', columns: [] }],
  indexes: [],
  includeIndexRecommendations: false,
};

const answer = {
  optimizedQuery:
    'SELECT u.* FROM users u WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id)',
  reasoning: 'r',
  keyIssues: ['k'],
  indexRecommendations: [
    { tableName: 'orders', indexDefinition: 'CREATE INDEX i ON orders(user_id)', reasoning: 'x' },
  ],
};

describe('runOptimizerAgent', () => {
  it('runs model tool calls through the guard and EXPLAIN, then returns the structured answer', async () => {
    const explain = vi.fn(async () => ({ rows: [], queryCost: 40 }));
    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          { name: 'explain_query', args: { query: answer.optimizedQuery }, id: '1' },
          { name: 'explain_query', args: { query: 'DROP TABLE users' }, id: '2' },
        ],
        // Final turn: the model answers through the structured-output tool.
        [{ name: 'optimization_result', args: answer, id: '3' }],
      ],
    });

    const out = await runOptimizerAgent(input, {
      model: model as any,
      database: 'testdb',
      explain,
    });

    expect(explain).toHaveBeenCalledTimes(1); // the DROP never reached the database
    expect(out.attempts).toHaveLength(2);
    expect(out.attempts.find((a) => a.error)?.query).toBe('DROP TABLE users');
    expect(out.attempts.find((a) => !a.error)?.queryCost).toBe(40);
    expect(out.optimizedQuery).toBe(answer.optimizedQuery);
    expect(out.indexRecommendations).toEqual([]); // stripped: not requested
  });
});
