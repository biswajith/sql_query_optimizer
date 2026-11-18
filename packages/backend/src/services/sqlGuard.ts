import { Parser } from 'node-sql-parser';
import { AppError, ErrorType } from '../middleware/errorHandler';

const parser = new Parser();

const PARSER_OPTIONS = { database: 'MySQL' };

// Functions with side effects, timing/locking behaviour, file access, or
// that echo their argument in an error message. None has a place in a query
// someone wants optimized, and each is a data-exfiltration primitive.
const BLOCKED_FUNCTIONS = new Set([
  'sleep',
  'benchmark',
  'get_lock',
  'release_lock',
  'release_all_locks',
  'is_free_lock',
  'is_used_lock',
  'load_file',
  'extractvalue',
  'updatexml',
  'master_pos_wait',
  'source_pos_wait',
  'wait_for_executed_gtid_set',
  'gtid_subset',
  'gtid_subtract',
  'st_latfromgeohash',
  'st_longfromgeohash',
  'st_pointfromgeohash',
]);

export interface GuardedQuery {
  /**
   * The query re-serialized from the validated syntax tree. This, never the
   * caller's text, is what may be sent to MySQL: comments (including MySQL
   * executable comments, which the parser cannot see into) do not survive
   * re-serialization, so MySQL runs exactly what was validated.
   */
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
  const input = sql.trim().replace(/;\s*$/, '').trim();

  // MySQL executes the contents of /*! ... */ and honours /*+ ... */ hints,
  // while the parser treats both as plain comments. Refuse them outright
  // rather than rely only on re-serialization dropping them.
  if (/\/\*[!+]/.test(input)) {
    throw new AppError(
      ErrorType.SECURITY_ERROR,
      'Executable comments (/*! ... */) and optimizer hint comments (/*+ ... */) are not allowed',
      403
    );
  }

  let parsed;
  try {
    parsed = parser.parse(input, PARSER_OPTIONS);
  } catch (error: any) {
    throw new AppError(
      ErrorType.PARSE_ERROR,
      `Could not parse the query as a MySQL SELECT statement: ${firstLine(error?.message)}`,
      400
    );
  }

  const statements = Array.isArray(parsed.ast) ? parsed.ast : [parsed.ast];

  if (statements.length !== 1) {
    throw new AppError(ErrorType.SECURITY_ERROR, 'Only a single statement is allowed', 403);
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
      throw new AppError(ErrorType.SECURITY_ERROR, 'SELECT ... INTO is not allowed', 403);
    }
    if (node.locking_read) {
      throw new AppError(
        ErrorType.SECURITY_ERROR,
        'Locking reads (FOR UPDATE / FOR SHARE) are not allowed',
        403
      );
    }
  }

  const blocked = findBlockedFunction(ast);
  if (blocked) {
    throw new AppError(
      ErrorType.SECURITY_ERROR,
      `The function ${blocked.toUpperCase()}() is not allowed`,
      403
    );
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

  let query: string;
  try {
    query = parser.sqlify(ast, PARSER_OPTIONS);
  } catch (error: any) {
    throw new AppError(
      ErrorType.PARSE_ERROR,
      'The query uses syntax this tool cannot safely reproduce',
      400
    );
  }

  return { query, tables: [...tables] };
}

function functionName(node: any): string | null {
  const name = node?.name;
  if (typeof name === 'string') return name;
  const parts = name?.name;
  if (Array.isArray(parts)) {
    // Qualified names (schema.func) are stored functions: take the last part.
    const last = parts[parts.length - 1];
    return typeof last?.value === 'string' ? last.value : null;
  }
  return null;
}

/** Depth-first search of the syntax tree for a disallowed function call. */
function findBlockedFunction(node: any): string | null {
  if (!node || typeof node !== 'object') return null;

  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findBlockedFunction(child);
      if (found) return found;
    }
    return null;
  }

  if (node.type === 'function') {
    const name = functionName(node);
    if (name && BLOCKED_FUNCTIONS.has(name.toLowerCase())) return name;
  }

  for (const value of Object.values(node)) {
    const found = findBlockedFunction(value);
    if (found) return found;
  }
  return null;
}

function firstLine(message: unknown): string {
  return String(message ?? 'syntax error')
    .split('\n')[0]
    .slice(0, 200);
}
