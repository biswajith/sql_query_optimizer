import { getDbPool } from '../config/database';
import { ExplainPlanRow, TableInfo, IndexInfo, ColumnInfo } from '@sql-optimizer/shared';
import { logger } from '../utils/logger';
import { validateAndExecute } from './queryValidator';

export async function getTableSchema(tableName: string): Promise<TableInfo> {
  return validateAndExecute(
    `SHOW CREATE TABLE ${tableName}`,
    async () => {
      const pool = getDbPool();
      
      // Get CREATE TABLE statement
      const [createRows] = await pool.query<any[]>(
        `SHOW CREATE TABLE ??`,
        [tableName]
      );
      
      if (!createRows || createRows.length === 0) {
        throw new Error(`Table ${tableName} not found`);
      }
      
      const createStatement = createRows[0]['Create Table'];
      
      // Get column information
      const [columns] = await pool.query<any[]>(
        `SHOW COLUMNS FROM ??`,
        [tableName]
      );
      
      const columnInfo: ColumnInfo[] = columns.map((col: any) => ({
        name: col.Field,
        type: col.Type,
        nullable: col.Null === 'YES',
        key: col.Key || '',
        default: col.Default,
        extra: col.Extra || '',
      }));
      
      logger.debug(`Fetched schema for table: ${tableName}`);
      
      return {
        tableName,
        createStatement,
        columns: columnInfo,
      };
    }
  );
}

export async function getTableIndexes(tableName: string): Promise<IndexInfo[]> {
  return validateAndExecute(
    `SHOW INDEX FROM ${tableName}`,
    async () => {
      const pool = getDbPool();
      const [rows] = await pool.query<any[]>(
        `SHOW INDEX FROM ??`,
        [tableName]
      );
      
      const indexes: IndexInfo[] = rows.map((row: any) => ({
        tableName: row.Table,
        indexName: row.Key_name,
        columnName: row.Column_name,
        indexType: row.Index_type,
        cardinality: row.Cardinality || 0,
        nonUnique: row.Non_unique,
      }));
      
      logger.debug(`Fetched ${indexes.length} indexes for table: ${tableName}`);
      
      return indexes;
    }
  );
}

export async function executeExplain(query: string): Promise<ExplainPlanRow[]> {
  const explainQuery = `EXPLAIN ${query}`;
  
  return validateAndExecute(
    explainQuery,
    async () => {
      const pool = getDbPool();
      
      try {
        const [rows] = await pool.query<any[]>(explainQuery);
        
        const explainPlan: ExplainPlanRow[] = rows.map((row: any) => ({
          id: row.id || 0,
          select_type: row.select_type || '',
          table: row.table || '',
          type: row.type || '',
          possible_keys: row.possible_keys,
          key: row.key,
          key_len: row.key_len,
          ref: row.ref,
          rows: row.rows || 0,
          filtered: row.filtered || 100,
          Extra: row.Extra || '',
        }));
        
        logger.debug(`EXPLAIN plan generated for query`);
        
        return explainPlan;
      } catch (error: any) {
        logger.error('EXPLAIN execution failed:', error);
        throw new Error(`Failed to execute EXPLAIN: ${error.message}`);
      }
    }
  );
}

