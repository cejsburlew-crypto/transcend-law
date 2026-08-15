// Database Connection Pool
// PostgreSQL connection management

import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  user: process.env.DB_USER || 'transcend_admin',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'transcend_law',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export async function getConnection(): Promise<PoolClient> {
  return await pool.connect();
}

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`Slow query (${duration}ms):`, text);
    }
    return result;
  } catch (error) {
    console.error('Query error:', error, { text, params });
    throw error;
  }
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getConnection();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function initializeDatabase() {
  try {
    console.log('🗄️  Initializing database...');

    // Check if tables exist
    const result = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'users'
      )`
    );

    if (result.rows[0].exists) {
      console.log('✅ Database already initialized');
      return;
    }

    // Read schema file
    const fs = require('fs').promises;
    const schema = await fs.readFile(
      require.resolve('./schema.sql'),
      'utf-8'
    );

    // Execute schema
    await pool.query(schema);
    console.log('✅ Database schema created successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

export async function closePool() {
  await pool.end();
  console.log('✅ Database pool closed');
}

export default pool;
