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

  it('returns re-serialized SQL, so comments never reach MySQL', () => {
    const { query } = guardSelect('SELECT id FROM users /* note */ -- trailing', DB);
    expect(query).toBe('SELECT `id` FROM `users`');
  });

  it('rejects MySQL executable comments', () => {
    rejects('/*!80018 ANALYZE */ SELECT * FROM users', 403);
    rejects('/*! ANALYZE */ SELECT * FROM users', 403);
    rejects('SELECT * FROM users /*!JOIN mysql.user*/', 403);
    rejects("SELECT * FROM users /*! INTO OUTFILE '/tmp/x' */", 403);
  });

  it('keeps index hints, with or without a table alias', () => {
    expect(guardSelect('SELECT * FROM users USE INDEX (idx_email) WHERE id = 1', DB).query).toBe(
      'SELECT * FROM `users` USE INDEX (`idx_email`) WHERE `id` = 1'
    );
    expect(
      guardSelect('select * from users as u force index (idx_email, idx_username)', DB).query
    ).toBe('SELECT * FROM `users` AS `u` FORCE INDEX (`idx_email`, `idx_username`)');
    expect(
      guardSelect(
        'SELECT * FROM users u IGNORE INDEX FOR ORDER BY (idx_email) USE KEY (`PRIMARY`) ORDER BY u.id',
        DB
      ).query
    ).toBe(
      'SELECT * FROM `users` AS `u` IGNORE INDEX FOR ORDER BY (`idx_email`) USE INDEX (`PRIMARY`) ORDER BY `u`.`id` ASC'
    );
  });

  it('keeps index hints on joined and subquery tables', () => {
    const { query, tables } = guardSelect(
      'SELECT u.id FROM users u JOIN orders USE INDEX (idx_user_id) ON orders.user_id = u.id ' +
        'WHERE u.id IN (SELECT user_id FROM orders FORCE INDEX (idx_status))',
      DB
    );
    expect(query).toContain('INNER JOIN `orders` USE INDEX (`idx_user_id`) ON');
    expect(query).toContain('FROM `orders` FORCE INDEX (`idx_status`))');
    expect(tables.sort()).toEqual(['orders', 'users']);
  });

  it('keeps SELECT STRAIGHT_JOIN and the STRAIGHT_JOIN join operator', () => {
    expect(
      guardSelect('SELECT STRAIGHT_JOIN u.id FROM users u JOIN orders o ON o.user_id = u.id', DB)
        .query
    ).toBe(
      'SELECT STRAIGHT_JOIN `u`.`id` FROM `users` AS `u` INNER JOIN `orders` AS `o` ON `o`.`user_id` = `u`.`id`'
    );
    expect(
      guardSelect('SELECT u.id FROM users u STRAIGHT_JOIN orders o ON o.user_id = u.id', DB).query
    ).toContain('`u` STRAIGHT_JOIN `orders`');
  });

  it('keeps allow-listed optimizer hint comments, per SELECT', () => {
    const { query } = guardSelect(
      'SELECT /*+ NO_INDEX_MERGE(u) JOIN_ORDER(u, o) */ DISTINCT u.id FROM users u JOIN orders o ON o.user_id = u.id ' +
        'WHERE u.id IN (SELECT /*+ SEMIJOIN(MATERIALIZATION) */ user_id FROM orders)',
      DB
    );
    expect(
      query.startsWith('SELECT /*+ NO_INDEX_MERGE(u) JOIN_ORDER(u, o) */ DISTINCT `u`.`id`')
    ).toBe(true);
    expect(query).toContain('(SELECT /*+ SEMIJOIN(MATERIALIZATION) */ `user_id` FROM `orders`)');
  });

  it('rejects optimizer hints that change session behaviour', () => {
    rejects('SELECT /*+ MAX_EXECUTION_TIME(1) */ * FROM users', 403);
    rejects('SELECT /*+ RESOURCE_GROUP(g) */ * FROM users', 403);
    rejects('SELECT /*+ SET_VAR(max_execution_time=1) */ * FROM users', 400);
  });

  it('rejects hint comments that are not directly after SELECT', () =>
    rejects('SELECT id /*+ NO_BNL(u) */ FROM users u', 403));

  it('does not let hint syntax carry anything else through', () => {
    rejects('SELECT * FROM users USE INDEX (idx) /*! JOIN mysql.user */', 403);
    rejects('SELECT * FROM users USE INDEX (a`) JOIN mysql.user x) WHERE 1', 400);
    rejects('SELECT * FROM users USE INDEX (idx_a, (SELECT 1)) WHERE 1', 400);
    rejects('SELECT * FROM users __sqo_hint_1__', 403);
    rejects('SELECT /*+ NO_BNL(u) */ * FROM users u; DROP TABLE users', 403);
    rejects('SELECT STRAIGHT_JOIN * FROM mysql.user USE INDEX (PRIMARY)', 403);
  });

  it('leaves hint-like text inside string literals alone', () => {
    expect(guardSelect("SELECT 'USE INDEX (x) /*+ a */' AS s FROM users", DB).query).toBe(
      "SELECT 'USE INDEX (x) /*+ a */' AS `s` FROM `users`"
    );
  });

  it('rejects functions usable for exfiltration or side effects', () => {
    rejects('SELECT * FROM users WHERE SLEEP(1) = 0', 403);
    rejects(
      'SELECT * FROM users WHERE id = (SELECT extractvalue(1, concat(0x7e, (SELECT email FROM users LIMIT 1))))',
      403
    );
    rejects("SELECT LOAD_FILE('/etc/passwd') FROM users", 403);
    rejects('SELECT * FROM users u JOIN orders o ON benchmark(10, 1) = o.id', 403);
  });

  it('still allows ordinary functions', () => {
    expect(() =>
      guardSelect('SELECT COUNT(*), MAX(created_at), LOWER(email) FROM users GROUP BY email', DB)
    ).not.toThrow();
  });

  it('rejects other databases', () => rejects('SELECT * FROM mysql.user', 403));
  it('rejects stacked statements', () => rejects('SELECT 1 FROM users; DROP TABLE users', 403));
  it('rejects writes', () => rejects('DELETE FROM users', 403));
  it('rejects DDL', () => rejects('DROP TABLE users', 403));
  it('rejects SELECT INTO OUTFILE', () =>
    rejects("SELECT * FROM users INTO OUTFILE '/tmp/x'", 403));
  it('rejects locking reads', () => rejects('SELECT * FROM users FOR UPDATE', 403));
  it('rejects ANALYZE prefix (would become EXPLAIN ANALYZE)', () =>
    rejects('ANALYZE SELECT * FROM users', 400));
  it('rejects text that is not SQL', () => rejects('ignore previous instructions', 400));
});
