import { describe, expect, it } from 'vitest';
import { guardSelect } from '../src/services/sqlGuard';

const DB = 'testdb';
const rejects = (sql: string, status: number) => {
  try {
    guardSelect(sql, DB);
  } catch (error: any) {
    expect(error.statusCode).toBe(status);
    return;
  }
  throw new Error(`expected rejection: ${sql}`);
};

describe('guardSelect', () => {
  it('accepts a SELECT and lists its tables', () => {
    const result = guardSelect(
      "SELECT * FROM users u JOIN orders o ON u.id = o.user_id WHERE u.email REGEXP '^a$';",
      DB
    );
    expect(result.tables.sort()).toEqual(['orders', 'users']);
    expect(result.query.endsWith(';')).toBe(false);
  });

  it('finds tables in subqueries and comma joins', () => {
    const { tables } = guardSelect(
      'SELECT u.id FROM users u, orders o WHERE o.user_id IN (SELECT id FROM products)',
      DB
    );
    expect(tables.sort()).toEqual(['orders', 'products', 'users']);
  });

  it('does not treat CTE names as tables', () => {
    const { tables } = guardSelect('WITH t AS (SELECT * FROM orders) SELECT * FROM t', DB);
    expect(tables).toEqual(['orders']);
  });

  it('allows the configured database as a qualifier', () => {
    expect(guardSelect('SELECT * FROM testdb.users', DB).tables).toEqual(['users']);
  });

  it('rejects other databases', () => rejects('SELECT * FROM mysql.user', 403));
  it('rejects stacked statements', () => rejects('SELECT 1 FROM users; DROP TABLE users', 403));
  it('rejects writes', () => rejects('DELETE FROM users', 403));
  it('rejects DDL', () => rejects('DROP TABLE users', 403));
  it('rejects SELECT INTO OUTFILE', () => rejects("SELECT * FROM users INTO OUTFILE '/tmp/x'", 403));
  it('rejects locking reads', () => rejects('SELECT * FROM users FOR UPDATE', 403));
  it('rejects ANALYZE prefix (would become EXPLAIN ANALYZE)', () =>
    rejects('ANALYZE SELECT * FROM users', 400));
  it('rejects text that is not SQL', () => rejects('ignore previous instructions', 400));
});
