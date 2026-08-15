export interface QueryResult {
  rows: any[];
  rowCount: number;
}

export interface Connection {
  query(text: string, values?: any[]): Promise<QueryResult>;
  close(): Promise<void>;
}

export function query(text: string, values?: any[]): Promise<QueryResult>;
export function transaction<T>(callback: (conn: Connection) => Promise<T>): Promise<T>;
export function getConnection(): Promise<Connection>;
