import { getDbPool, getDatabaseName, STATEMENT_TIMEOUT_MS } from '../config/database';
import { ExplainPlanRow, TableInfo, IndexInfo, ColumnInfo } from '@sql-optimizer/shared';
import { AppError, ErrorType } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface ExplainResult {
  rows: ExplainPlanRow[];
  /** Optimizer's estimated total cost, from EXPLAIN FORMAT=JSON. */
  queryCost: number | null;
}

// MySQL's own error text is never sent to the client: functions such as
// EXTRACTVALUE echo their argument in the message, which turns error output
// into a channel for reading row data. Clients get a fixed message chosen by
// error code; the detail is logged server-side.
const SQL_ERROR_MESSAGES: Record<string, string> = {
  ER_PARSE_ERROR: 'MySQL could not parse the query (syntax error)',
  ER_NO_SUCH_TABLE: 'A table referenced by the query does not exist',
  ER_BAD_TABLE_ERROR: 'A table referenced by the query does not exist',
  ER_BAD_FIELD_ERROR: 'The query references a column that does not exist',
  ER_NON_UNIQ_ERROR: 'The query has an ambiguous column reference',
  ER_NONUNIQ_TABLE: 'The query uses the same table name or alias twice',
  ER_WRONG_FIELD_WITH_GROUP: 'The query selects a non-aggregated column not in GROUP BY',
  ER_SP_DOES_NOT_EXIST: 'The query calls a function that does not exist',
  ER_TABLEACCESS_DENIED_ERROR: 'The database user is not allowed to read a referenced table',
  ER_DBACCESS_DENIED_ERROR: 'The database user is not allowed to access that database',
  ER_QUERY_TIMEOUT: 'MySQL timed out while planning the query',
};

/**
 * Turn a mysql2 error into an AppError the client can act on: SQL-level
 * problems are the caller's and return 400 with a fixed message;
 * connectivity problems return 503.
 */
function toAppError(error: any, context: string): AppError {
  if (error instanceof AppError) return error;

  if (error?.sqlMessage) {
    logger.warn(`${context}: [${error.code}] ${error.sqlMessage}`);
    const message = SQL_ERROR_MESSAGES[error.code] ?? 'MySQL rejected the query';
    return new AppError(ErrorType.DATABASE_ERROR, `${context}: ${message}`, 400, {
      code: error.code,
    });
  }

  logger.error(`${context}:`, error);
  return new AppError(ErrorType.DATABASE_ERROR, 'Database is unavailable', 503);
}

async function run(sql: string, values?: unknown[]): Promise<any[]> {
  const [rows] = await getDbPool().query<any[]>({ sql, values, timeout: STATEMENT_TIMEOUT_MS });
  return rows;
}

// Table names always come from the SQL parser and are bound as identifiers
// against the configured database, so they cannot reach other schemas.
export async function getTableSchema(tableName: string): Promise<TableInfo> {
  const db = getDatabaseName();
  try {
    const createRows = await run('SHOW CREATE TABLE ??.??', [db, tableName]);
    const createRow = createRows[0] ?? {};
    // Views come back under "Create View" instead of "Create Table".
    const createStatement: string = createRow['Create Table'] ?? createRow['Create View'] ?? '';

    const columns = await run('SHOW COLUMNS FROM ??.??', [db, tableName]);
    const columnInfo: ColumnInfo[] = columns.map((col: any) => ({
      name: col.Field,
      type: col.Type,
      nullable: col.Null === 'YES',
      key: col.Key || '',
      default: col.Default,
      extra: col.Extra || '',
    }));

    logger.debug(`Fetched schema for table: ${tableName}`);
    return { tableName, createStatement, columns: columnInfo };
  } catch (error) {
    throw toAppError(error, `Could not read schema for "${tableName}"`);
  }
}

export async function getTableIndexes(tableName: string): Promise<IndexInfo[]> {
  try {
    const rows = await run('SHOW INDEX FROM ??.??', [getDatabaseName(), tableName]);
    return rows.map((row: any) => ({
      tableName: row.Table,
      indexName: row.Key_name,
      columnName: row.Column_name,
      indexType: row.Index_type,
      cardinality: Number(row.Cardinality ?? 0),
      nonUnique: row.Non_unique,
    }));
  } catch (error) {
    throw toAppError(error, `Could not read indexes for "${tableName}"`);
  }
}

/**
 * EXPLAIN a query. Only ever pass GuardedQuery.query from guardSelect here,
 * never caller-supplied text: the statement is built by concatenation.
 */
export async function executeExplain(guardedQuery: string): Promise<ExplainResult> {
  try {
    const rows = await run(`EXPLAIN ${guardedQuery}`);
    const explainRows: ExplainPlanRow[] = rows.map((row: any) => ({
      id: row.id ?? 0,
      select_type: row.select_type ?? '',
      table: row.table ?? '',
      type: row.type ?? '',
      possible_keys: row.possible_keys ?? null,
      key: row.key ?? null,
      key_len: row.key_len ?? null,
      ref: row.ref ?? null,
      rows: Number(row.rows ?? 0),
      filtered: Number(row.filtered ?? 100),
      Extra: row.Extra ?? '',
    }));

    return { rows: explainRows, queryCost: await explainCost(guardedQuery) };
  } catch (error) {
    throw toAppError(error, 'EXPLAIN failed');
  }
}

async function explainCost(guardedQuery: string): Promise<number | null> {
  try {
    const rows = await run(`EXPLAIN FORMAT=JSON ${guardedQuery}`);
    const raw = rows[0]?.EXPLAIN;
    const plan = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const cost = Number(plan?.query_block?.cost_info?.query_cost);
    return Number.isFinite(cost) ? cost : null;
  } catch (error) {
    // The tabular plan is still useful without a cost figure.
    logger.warn('EXPLAIN FORMAT=JSON failed; continuing without a cost');
    return null;
  }
}
