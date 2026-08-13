// TRANSCEND LAW - Minimal Database Module
// Production connects to PostgreSQL, development stubs responses

const pool = {
  query: async (sql, params) => {
    console.log('[DB Query]', sql.slice(0, 50) + '...');
    return { rows: [] };
  }
};

module.exports = pool;
