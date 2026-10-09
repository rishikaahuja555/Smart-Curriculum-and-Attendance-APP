import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const migrationsDirectory = join(root, 'db', 'migrations');

export async function applyMigrations() {
  if (!pool) {
    return { applied: 0, skipped: true, reason: 'DATABASE_URL is not configured.' };
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = readdirSync(migrationsDirectory)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    let applied = 0;
    for (const file of files) {
      const migrationName = file;
      const checkpoint = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [migrationName]);
      if (checkpoint.rowCount > 0) continue;

      const sql = readFileSync(join(migrationsDirectory, file), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migrationName]);
      applied += 1;
    }

    return { applied, skipped: false };
  } finally {
    client.release();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await applyMigrations();
  if (result.skipped) {
    console.log(result.reason);
  } else {
    console.log(`Applied ${result.applied} PostgreSQL migration(s).`);
  }
}
