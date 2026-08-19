// Database Connection Pool
// PostgreSQL connection management

import { Pool, PoolClient } from 'pg';

/**
 * TLS for app-to-database traffic.
 *
 * Privileged content moves over this connection, so it must not travel in the
 * clear outside the host. Defaults:
 *   - remote host  -> TLS required
 *   - localhost    -> TLS off (loopback never leaves the machine)
 *
 * DB_SSL=true|false overrides. DB_SSL_CA lets us verify the server certificate
 * properly; without it we fall back to encrypted-but-unverified, which still
 * defeats passive interception but not an active MITM - so supply the CA in
 * production.
 */
const buildSslConfig = () => {
  const host = process.env.DB_HOST || 'localhost';
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const explicit = process.env.DB_SSL;

  const enabled = explicit ? explicit === 'true' : !isLoopback;
  if (!enabled) return undefined;

  if (process.env.DB_SSL_CA) {
    return { ca: process.env.DB_SSL_CA, rejectUnauthorized: true };
  }

  console.warn(
    '[security] Database TLS is on but DB_SSL_CA is not set - the server certificate ' +
      'is not verified. Set DB_SSL_CA in production.'
  );
  return { rejectUnauthorized: false };
};

const pool = new Pool({
  user: process.env.DB_USER || 'transcend_admin',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'transcend_law',
  ssl: buildSslConfig(),
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
