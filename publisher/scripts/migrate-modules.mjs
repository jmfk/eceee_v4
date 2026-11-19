import { readFile } from 'node:fs/promises';
import pg from 'pg';

// Secret values stay inside this process. Output is intentionally bounded.
const url = process.env.MODULE_MIGRATION_DATABASE_URL;
const expectedDatabase = process.env.MODULE_EXPECTED_DATABASE;
const expectedRole = process.env.MODULE_MIGRATION_ROLE;
const runtimeRole = process.env.MODULE_RUNTIME_ROLE || 'eceee_modules';
if (!url || !expectedDatabase || !expectedRole || !/^[a-z][a-z0-9_]{0,62}$/.test(runtimeRole)) {
  console.error('Module migration configuration: missing or invalid'); process.exit(1);
}
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
try {
  await client.connect();
  const { rows: [identity] } = await client.query('SELECT current_database() AS database,current_user AS role');
  if (identity.database !== expectedDatabase || identity.role !== expectedRole) throw new Error('identity');
  const { rows: [role] } = await client.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1', [runtimeRole]);
  if (!role || role.rolsuper || role.rolbypassrls || runtimeRole === expectedRole) throw new Error('runtime role');
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('eceee:modules:schema',0))");
  await client.query(await readFile(new URL('../migrations/001_modules.sql', import.meta.url), 'utf8'));
  await client.query('REVOKE ALL ON SCHEMA modules FROM PUBLIC');
  await client.query('REVOKE ALL ON ALL TABLES IN SCHEMA modules FROM PUBLIC');
  await client.query(`GRANT USAGE ON SCHEMA modules TO "${runtimeRole}"`);
  await client.query(`GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA modules TO "${runtimeRole}"`);
  await client.query('COMMIT');
  console.log('Module schema: ready');
} catch {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Module migration: failed (check target identity, runtime role and schema compatibility)');
  process.exitCode = 1;
} finally { await client.end().catch(() => {}); }
