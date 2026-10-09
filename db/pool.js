import pg from 'pg';
import { config } from '../server/config.js';

const { Pool } = pg;

export const pool = config.databaseUrl
  ? new Pool({
      connectionString: config.databaseUrl,
      max: config.dbPoolMax,
      ssl: config.isProduction ? { rejectUnauthorized: false } : false
    })
  : null;

export function getPool() {
  return pool;
}

export async function withTransaction(callback) {
  if (!pool) {
    return callback({
      query: async () => ({ rows: [], rowCount: 0, fields: [] }),
      release: () => undefined
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
