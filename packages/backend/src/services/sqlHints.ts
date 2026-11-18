import { AppError, ErrorType } from '../middleware/errorHandler';

/**
 * MySQL hint support for the SQL guard.
 *
 * The SQL parser we validate with does not understand index hints
 * (USE/FORCE/IGNORE INDEX), the SELECT STRAIGHT_JOIN modifier, or optimizer
 * hint comments. An optimizer tool has to accept all three, so this module
 * lifts them out before parsing and puts them back afterwards:
 *
 *   1. extractHints() tokenizes the input, removes each hint, and leaves a
 *      unique marker identifier in its place (a table alias for index hints,
 *      a leading select column for SELECT-level hints).
 *   2. The guard parses, validates and re-serializes the marker version.
 *   3. restoreHints() swaps each marker in the re-serialized SQL for hint
 *      text that this module generated itself.
 *
 * Security property: nothing from the caller's text is copied into the final
 * SQL. Restored hints are built only from fixed keywords, an allow-list of
 * optimizer hint names, and identifiers restricted to [A-Za-z0-9_$]. A
 * tokenizer mistake can therefore misplace or drop a hint, but cannot
 * smuggle SQL past the parser.
 */

const MARKER_PREFIX = '__sqo_hint_';
const SAFE_IDENT = /^[A-Za-z0-9_$]+$/;

const SELECT_OPTIONS = new Set([
  'ALL',
  'DISTINCT',
  'DISTINCTROW',
  'HIGH_PRIORITY',
  'SQL_SMALL_RESULT',
  'SQL_BIG_RESULT',
  'SQL_BUFFER_RESULT',
  'SQL_NO_CACHE',
  'SQL_CALC_FOUND_ROWS',
]);

// Optimizer hints that only steer the plan. Deliberately absent: SET_VAR,
// MAX_EXECUTION_TIME and RESOURCE_GROUP, which change session behaviour.
const OPTIMIZER_HINTS = new Set([
  'BKA',
  'NO_BKA',
  'BNL',
  'NO_BNL',
  'HASH_JOIN',
  'NO_HASH_JOIN',
  'MRR',
  'NO_MRR',
  'NO_ICP',
  'NO_RANGE_OPTIMIZATION',
  'INDEX_MERGE',
  'NO_INDEX_MERGE',
  'SKIP_SCAN',
  'NO_SKIP_SCAN',
  'SEMIJOIN',
  'NO_SEMIJOIN',
  'SUBQUERY',
  'MERGE',
  'NO_MERGE',
  'DERIVED_CONDITION_PUSHDOWN',
  'NO_DERIVED_CONDITION_PUSHDOWN',
  'JOIN_FIXED_ORDER',
  'JOIN_ORDER',
  'JOIN_PREFIX',
  'JOIN_SUFFIX',
  'QB_NAME',
  'INDEX',
  'NO_INDEX',
  'JOIN_INDEX',
  'NO_JOIN_INDEX',
  'GROUP_INDEX',
  'NO_GROUP_INDEX',
  'ORDER_INDEX',
  'NO_ORDER_INDEX',
]);

type TokenType = 'space' | 'comment' | 'string' | 'quoted' | 'word' | 'punct';

interface Token {
  type: TokenType;
  text: string;
}

interface TableHint {
  /** The table's real alias, or null if it had none. */
  alias: string | null;
  text: string;
}

interface SelectHint {
  optimizerHints: string | null;
  straightJoin: boolean;
}

export interface ExtractedHints {
  /** The query with hints replaced by markers, ready for the parser. */
  sql: string;
  tableHints: Map<string, TableHint>;
  selectHints: Map<string, SelectHint>;
}

function reject(message: string, status = 400): never {
  throw new AppError(
    status === 403 ? ErrorType.SECURITY_ERROR : ErrorType.PARSE_ERROR,
    message,
    status
  );
}

/** A small MySQL lexer: enough to tell code from strings and comments. */
function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const readQuoted = (quote: string, allowBackslash: boolean): string => {
    let j = i + 1;
    while (j < sql.length) {
      if (allowBackslash && sql[j] === '\\') {
        j += 2;
      } else if (sql[j] === quote) {
        if (sql[j + 1] === quote)
          j += 2; // doubled quote is an escape
        else return sql.slice(i, j + 1);
      } else {
        j++;
      }
    }
    return reject('Unterminated quoted string or identifier in the query');
  };

  while (i < sql.length) {
    const ch = sql[i];
    let text: string;
    let type: TokenType;

    if (/\s/.test(ch)) {
      type = 'space';
      text = /^\s+/.exec(sql.slice(i))![0];
    } else if (
      ch === '#' ||
      (sql.startsWith('--', i) && (i + 2 >= sql.length || /\s/.test(sql[i + 2])))
    ) {
      type = 'comment';
      const end = sql.indexOf('\n', i);
      text = sql.slice(i, end === -1 ? sql.length : end);
    } else if (sql.startsWith('/*', i)) {
      type = 'comment';
      const end = sql.indexOf('*/', i + 2);
      if (end === -1) reject('Unterminated comment in the query');
      text = sql.slice(i, end + 2);
    } else if (ch === "'" || ch === '"') {
      type = 'string';
      text = readQuoted(ch, true);
    } else if (ch === '`') {
      type = 'quoted';
      text = readQuoted('`', false);
    } else if (/[A-Za-z0-9_$\u0080-￿]/.test(ch)) {
      type = 'word';
      text = /^[A-Za-z0-9_$\u0080-￿]+/.exec(sql.slice(i))![0];
    } else {
      type = 'punct';
      text = ch;
    }

    tokens.push({ type, text });
    i += text.length;
  }

  return tokens;
}

const isWord = (token: Token | undefined, ...words: string[]): boolean =>
  token?.type === 'word' && words.includes(token.text.toUpperCase());

const isPunct = (token: Token | undefined, ...chars: string[]): boolean =>
  token?.type === 'punct' && chars.includes(token.text);

/** The identifier's name if it is one we are willing to re-emit, else null. */
function identName(token: Token | undefined): string | null {
  if (!token) return null;
  const name =
    token.type === 'quoted' ? token.text.slice(1, -1) : token.type === 'word' ? token.text : null;
  return name !== null && SAFE_IDENT.test(name) ? name : null;
}

function validateOptimizerHints(body: string): string {
  const hints: string[] = [];
  const pattern = /\s*([A-Za-z_]+)\s*\(([A-Za-z0-9_$@`,.\s]*)\)\s*/y;
  let position = 0;

  while (position < body.length) {
    pattern.lastIndex = position;
    const match = pattern.exec(body);
    if (!match) reject('Could not understand the optimizer hint comment (/*+ ... */)');
    const name = match[1].toUpperCase();
    if (!OPTIMIZER_HINTS.has(name)) {
      reject(`The optimizer hint ${name} is not allowed`, 403);
    }
    hints.push(`${name}(${match[2].trim().replace(/\s+/g, ' ')})`);
    position = pattern.lastIndex;
  }

  if (hints.length === 0) reject('Empty optimizer hint comment (/*+ ... */)');
  return hints.join(' ');
}

/**
 * Parse one or more consecutive index hints starting at `start`. Returns the
 * regenerated hint text and the index of the first token after them, or null
 * if the tokens there are not an index hint.
 */
function parseIndexHints(tokens: Token[], start: number): { text: string; next: number } | null {
  const significant = (from: number): number => {
    let k = from;
    while (k < tokens.length && (tokens[k].type === 'space' || tokens[k].type === 'comment')) k++;
    return k;
  };

  const parts: string[] = [];
  let cursor = start;

  for (;;) {
    let k = significant(cursor);
    if (!isWord(tokens[k], 'USE', 'FORCE', 'IGNORE')) break;
    const action = tokens[k].text.toUpperCase();

    k = significant(k + 1);
    if (!isWord(tokens[k], 'INDEX', 'KEY')) break;

    k = significant(k + 1);
    let scope = '';
    if (isWord(tokens[k], 'FOR')) {
      k = significant(k + 1);
      if (isWord(tokens[k], 'JOIN')) {
        scope = ' FOR JOIN';
      } else if (isWord(tokens[k], 'ORDER', 'GROUP')) {
        scope = ` FOR ${tokens[k].text.toUpperCase()} BY`;
        k = significant(k + 1);
        if (!isWord(tokens[k], 'BY')) return null;
      } else {
        return null;
      }
      k = significant(k + 1);
    }

    if (!isPunct(tokens[k], '(')) return null;
    k = significant(k + 1);

    const names: string[] = [];
    while (!isPunct(tokens[k], ')')) {
      const name = identName(tokens[k]);
      if (name === null) return null;
      names.push(`\`${name}\``);
      k = significant(k + 1);
      if (isPunct(tokens[k], ',')) k = significant(k + 1);
      else if (!isPunct(tokens[k], ')')) return null;
    }

    parts.push(`${action} INDEX${scope} (${names.join(', ')})`);
    cursor = k + 1;
  }

  return parts.length > 0 ? { text: parts.join(' '), next: cursor } : null;
}

export function extractHints(input: string): ExtractedHints {
  if (input.toLowerCase().includes(MARKER_PREFIX)) {
    reject(`The query may not contain the reserved name "${MARKER_PREFIX}"`, 403);
  }

  const tokens = tokenize(input);
  const tableHints = new Map<string, TableHint>();
  const selectHints = new Map<string, SelectHint>();

  const out: string[] = [];
  // Significant (non-space, non-comment) tokens emitted so far, with where
  // each one sits in `out` so an alias can be rewritten in place.
  const emitted: { token: Token; index: number }[] = [];
  let markerCount = 0;
  const nextMarker = () => `${MARKER_PREFIX}${++markerCount}__`;

  // Non-null while reading the option words that directly follow a SELECT.
  let pending: (SelectHint & { justOpened: boolean }) | null = null;

  const emit = (token: Token) => {
    emitted.push({ token, index: out.length });
    out.push(token.text);
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'space') {
      out.push(' ');
      continue;
    }

    if (token.type === 'comment') {
      if (token.text.startsWith('/*!')) {
        reject('Executable comments (/*! ... */) are not allowed', 403);
      }
      if (token.text.startsWith('/*+')) {
        if (!pending?.justOpened) {
          reject('An optimizer hint comment (/*+ ... */) must directly follow SELECT', 403);
        }
        pending.optimizerHints = validateOptimizerHints(token.text.slice(3, -2));
        pending.justOpened = false;
      }
      out.push(' '); // every other comment is simply dropped
      continue;
    }

    if (pending) {
      if (isWord(token, 'STRAIGHT_JOIN')) {
        pending.straightJoin = true;
        pending.justOpened = false;
        out.push(' ');
        continue;
      }
      if (token.type === 'word' && SELECT_OPTIONS.has(token.text.toUpperCase())) {
        pending.justOpened = false;
        emit(token);
        continue;
      }
      // First real select expression: park the hints in a marker column.
      if (pending.optimizerHints || pending.straightJoin) {
        const marker = nextMarker();
        selectHints.set(marker, {
          optimizerHints: pending.optimizerHints,
          straightJoin: pending.straightJoin,
        });
        out.push(`${marker}, `);
      }
      pending = null;
    }

    if (isWord(token, 'SELECT')) {
      emit(token);
      pending = { optimizerHints: null, straightJoin: false, justOpened: true };
      continue;
    }

    if (isWord(token, 'USE', 'FORCE', 'IGNORE')) {
      const hint = parseIndexHints(tokens, i);
      if (hint) {
        const last = emitted[emitted.length - 1];
        const beforeLast = emitted[emitted.length - 2];
        const lastName = identName(last?.token);
        if (!last || !beforeLast || lastName === null) {
          reject('Index hint in a position this tool does not support');
        }

        const marker = nextMarker();
        const followsTableName =
          isPunct(beforeLast.token, '.', ',', '(') ||
          isWord(beforeLast.token, 'FROM', 'JOIN', 'STRAIGHT_JOIN');

        if (
          isWord(beforeLast.token, 'AS') ||
          (!followsTableName && identName(beforeLast.token) !== null)
        ) {
          // `tbl [AS] alias <hint>`: swap the alias for the marker.
          out[last.index] = marker;
          tableHints.set(marker, { alias: lastName, text: hint.text });
        } else if (followsTableName) {
          // `tbl <hint>`: give the table a marker alias.
          out.push(` AS ${marker}`);
          tableHints.set(marker, { alias: null, text: hint.text });
        } else {
          reject('Index hint in a position this tool does not support');
        }

        out.push(' ');
        i = hint.next - 1;
        continue;
      }
    }

    emit(token);
  }

  return { sql: out.join(''), tableHints, selectHints };
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** Put the extracted hints back into SQL re-serialized from the parse tree. */
export function restoreHints(serialized: string, hints: ExtractedHints): string {
  let sql = serialized;

  for (const [marker, hint] of hints.tableHints) {
    const needle = `AS \`${marker}\``;
    if (countOccurrences(sql, needle) !== 1) {
      reject('Index hint in a position this tool does not support');
    }
    sql = sql.replace(needle, () => (hint.alias ? `AS \`${hint.alias}\` ${hint.text}` : hint.text));
  }

  for (const [marker, hint] of hints.selectHints) {
    const needle = `\`${marker}\`, `;
    const position = sql.indexOf(needle);
    if (position === -1 || countOccurrences(sql, needle) !== 1) {
      reject('SELECT hint in a position this tool does not support');
    }
    // Only SELECT option keywords can sit between a SELECT and its first
    // column, so the nearest preceding SELECT is the one that owns the hint.
    const select = sql.lastIndexOf('SELECT', position);
    if (select === -1) reject('SELECT hint in a position this tool does not support');

    const restored =
      (hint.optimizerHints ? ` /*+ ${hint.optimizerHints} */` : '') +
      (hint.straightJoin ? ' STRAIGHT_JOIN' : '');
    const afterSelect = select + 'SELECT'.length;
    sql =
      sql.slice(0, afterSelect) +
      restored +
      sql.slice(afterSelect, position) +
      sql.slice(position + needle.length);
  }

  if (sql.includes(MARKER_PREFIX)) {
    reject('A hint could not be placed back into the query');
  }

  return sql;
}
