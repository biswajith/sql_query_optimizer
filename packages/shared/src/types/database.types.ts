// Table information
export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  key: string;
  default: string | null;
  extra: string;
}

export interface TableInfo {
  tableName: string;
  createStatement: string;
  columns: ColumnInfo[];
}

// Index information
export interface IndexInfo {
  tableName: string;
  indexName: string;
  columnName: string;
  indexType: string;
  cardinality: number;
  nonUnique: number;
}

// EXPLAIN plan types
export interface ExplainPlanRow {
  id: number;
  select_type: string;
  table: string;
  type: string;
  possible_keys: string | null;
  key: string | null;
  key_len: string | null;
  ref: string | null;
  rows: number;
  filtered: number;
  Extra: string;
}

