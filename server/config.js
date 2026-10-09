import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));

export const config = {
  rootDir: root,
  dataDirectory: process.env.AIRS_DATA_DIR || join(root, 'data'),
  databaseUrl: process.env.DATABASE_URL || null,
  port: Number(process.env.API_PORT || 3001),
  isProduction: process.env.NODE_ENV === 'production',
  sessionHours: 8,
  rememberMeSeconds: 30 * 24 * 60 * 60,
  dbPoolMax: Number(process.env.PG_POOL_MAX || 10),
  dbSchema: process.env.AIRS_DB_SCHEMA || 'public'
};
