// Path shim: '../db/connection' -> the pooled connection in src/database.

export * from '../src/database/connection';
export { Database, database } from '../database';
