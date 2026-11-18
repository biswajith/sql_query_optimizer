import mysql from 'mysql2/promise';
import { logger } from '../utils/logger';

export const STATEMENT_TIMEOUT_MS = parseInt(process.env.MYSQL_STATEMENT_TIMEOUT_MS || '10000');

export function getDatabaseName(): string {
  return process.env.MYSQL_DATABASE || 'testdb';
}

let pool: mysql.Pool | null = null;

export function getDbPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: getDatabaseName(),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: false,
    });

    // Defence in depth on top of a read-only DB user: every pooled
    // connection refuses writes and caps SELECT execution time.
    // (mysql2 emits the callback-style connection here, whatever the typings say.)
    pool.on('connection', (pooled) => {
      const connection = pooled as unknown as {
        query(sql: string, cb: (err: unknown) => void): void;
      };
      connection.query('SET SESSION TRANSACTION READ ONLY', (err: unknown) => {
        if (err) logger.warn('Could not set session read-only:', err);
      });
      connection.query(
        `SET SESSION MAX_EXECUTION_TIME = ${STATEMENT_TIMEOUT_MS}`,
        (err: unknown) => {
          if (err) logger.warn('Could not set MAX_EXECUTION_TIME:', err);
        }
      );
    });
  }
  return pool;
}

export async function testConnection(): Promise<boolean> {
  try {
    const connection = await getDbPool().getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    logger.error('MySQL connection test failed:', error);
    return false;
  }
}
