import { Parser } from 'node-sql-parser';
import { AppError, ErrorType } from '../middleware/errorHandler';

const parser = new Parser();

export interface GuardedQuery {
  /** The query with any trailing semicolon removed. */
  query: string;
  /** Real tables referenced (CTE names excluded), unqualified. */
  tables: string[];
}

/**
 * Deterministic gate for any SQL that will be sent to MySQL, whether it came
 * from the user or from the model. Accepts exactly one read-only SELECT
 * against the configured database and returns the tables it references.
 *
 * Throws AppError (400 for unparseable input, 403 for disallowed statements).
 */
export function guardSelect(sql: string, database: string): GuardedQuery {
  const query = sql.trim().replace(/;\s*$/, '').trim();

  let parsed;
  try {
    parsed = parser.parse(query, { database: 'MySQL' });
  } catch (error: any) {
    throw new AppError(
      ErrorType.PARSE_ERROR,
      `Could not parse the query as a MySQL SELECT statement: ${firstLine(error?.message)}`,
      400
    );
  }

  const statements = Array.isArray(parsed.ast) ? parsed.ast : [parsed.ast];

  if (statements.length !== 1) {
    throw new AppError(
      ErrorType.SECURITY_ERROR,
      'Only a single statement is allowed',
      403
    );
  }

  const ast: any = statements[0];

  if (ast.type !== 'select') {
    throw new AppError(
      ErrorType.SECURITY_ERROR,
      `Only SELECT statements can be optimized (got ${String(ast.type).toUpperCase()})`,
      403
    );
  }

  // Walk UNION branches too: each is its own select node.
  for (let node = ast; node; node = node._next) {
    if (node.into?.position) {
      throw new AppError(
        ErrorType.SECURITY_ERROR,
        'SELECT ... INTO is not allowed',
        403
      );
    }
    if (node.locking_read) {
      throw new AppError(
        ErrorType.SECURITY_ERROR,
        'Locking reads (FOR UPDATE / FOR SHARE) are not allowed',
        403
      );
    }
  }

  const cteNames = new Set<string>(
    (ast.with ?? []).map((cte: any) => String(cte.name?.value ?? cte.name).toLowerCase())
  );

  const tables = new Set<string>();
  for (const entry of parsed.tableList) {
    // Entries look like "select::<db|null>::<table>"
    const [, db, table] = entry.split('::');
    if (db && db !== 'null' && db.toLowerCase() !== database.toLowerCase()) {
      throw new AppError(
        ErrorType.SECURITY_ERROR,
        `Access to database "${db}" is not allowed`,
        403
      );
    }
    if ((!db || db === 'null') && cteNames.has(table.toLowerCase())) continue;
    tables.add(table);
  }

  return { query, tables: [...tables] };
}

function firstLine(message: unknown): string {
  return String(message ?? 'syntax error').split('\n')[0].slice(0, 200);
}
