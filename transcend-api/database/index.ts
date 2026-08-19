// Path shim: '../database' -> the pooled connection in src/database.
//
// Also exposes a `Database` facade: services written against an injected
// `Database` object (complianceReporting and friends) imported it from here,
// but it never existed, so those modules did not compile.

export * from '../src/database/connection';

import { query, transaction, getConnection } from '../src/database/connection';

/**
 * Database facade for services that take an injected client.
 * Backed by the connection pool.
 */
export interface Database {
  query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount?: number | null }>;
  transaction?<T>(callback: (client: any) => Promise<T>): Promise<T>;
}

/**
 * Repository surface that complianceReporting was written against.
 *
 * Declared separately from Database, and required rather than optional: the
 * service calls these unconditionally, so a caller must inject an object that
 * implements them. Nothing in the repo does yet - that is the remaining work,
 * and the type now says so instead of the calls failing to compile.
 */
export interface ComplianceRepository extends Database {
  saveReport(report: any): Promise<any>;
  getReport(id: string): Promise<any>;
  listReports(type?: string, limit?: number): Promise<any[]>;
  saveSchedule(schedule: any): Promise<any>;
  getSchedule(id: string): Promise<any>;
  getAllSchedules(): Promise<any[]>;
  deleteSchedule(id: string): Promise<void>;
}

/** Shared instance backed by the connection pool. */
export const database: Database = { query, transaction };

export { getConnection };
export default database;
