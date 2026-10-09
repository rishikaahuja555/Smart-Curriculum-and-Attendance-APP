import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const databasePath = process.env.AIRS_DB_PATH || join(root, 'data', 'airs.sqlite');
const database = new DatabaseSync(databasePath, { readOnly: true });
const tables = database.prepare(`SELECT name FROM sqlite_schema
  WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all();

for (const { name } of tables) {
  const quotedName = `"${name.replaceAll('"', '""')}"`;
  const { count } = database.prepare(`SELECT COUNT(*) AS count FROM ${quotedName}`).get();
  console.log(`${name}: ${count}`);
}

database.close();