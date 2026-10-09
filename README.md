# AIRS Demo Setup

The demo dataset is opt-in and is never seeded in production. Demo user passwords are hashed with the same scrypt helper as other accounts; the password is supplied through `AIRS_DEMO_PASSWORD` and is never printed.

## Local PostgreSQL Foundation

Phase 1 adds the PostgreSQL foundation expected by the AIRS backend: `pg` is installed, `DATABASE_URL` is read by `server/config.js`, and the migration runner under `db/migrate.js` applies SQL from `db/migrations/*.sql`.

### Start PostgreSQL locally

From the project root, run:

```powershell
docker compose up -d postgres
```

The included Compose file starts a PostgreSQL instance on port `5432` with the local credentials below. Set the environment before starting the app:

```powershell
$env:DATABASE_URL = 'postgresql://airs:airs_dev_password@127.0.0.1:5432/airs'
$env:NODE_ENV = 'development'
$env:AIRS_SEED_DEMO = '1'
$env:AIRS_DEMO_PASSWORD = 'choose-a-development-only-password'
npm run dev
```

If `DATABASE_URL` is not present, the current app continues to run with the existing SQLite setup for backwards compatibility while the migration foundation is exercised.

### Migrations

Apply the current migration set:

```powershell
node db/migrate.js
```

The migration runner creates the `schema_migrations` table and applies only new SQL files in order.

## Start the Demo

In PowerShell, from the project root:

```powershell
$env:NODE_ENV = 'development'
$env:AIRS_SEED_DEMO = '1'
$env:AIRS_DEMO_PASSWORD = 'choose-a-development-only-password'
npm run dev
```

The seed is transactional and safe to rerun. It only inserts missing rows with `airs-demo-` IDs or `@demo.airs.local` emails; it does not update or delete existing data. In development, the existing passwordless login still accepts an account ID. Demo IDs include student enrollment `DEMO-0001`, faculty name `Dr. Meera Iyer`, and admin email `admin@demo.airs.local`.

## Inspect and Clean Demo Data

Print row counts for every SQLite table:

```powershell
npm run demo:counts
```

Remove only identifiable demo rows, and only after explicitly enabling cleanup:

```powershell
$env:NODE_ENV = 'development'
$env:AIRS_CLEAN_DEMO = '1'
npm run demo:cleanup
```

The cleanup script refuses production and deletes only `airs-demo-` identifiers and users with `@demo.airs.local` emails.

## Checks

```powershell
npm test
npm run build
```