import { Pool, type PoolClient } from 'pg';

let pool: Pool | undefined;
export type Tx = PoolClient;
export async function transaction<T>(tenantId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  if (!process.env.PUBLISHER_MODULE_DATABASE_URL) throw new Error('Module database is not configured');
  pool ??= new Pool({ connectionString: process.env.PUBLISHER_MODULE_DATABASE_URL, max: 5,
    connectionTimeoutMillis: 5000, options: '-c statement_timeout=15000' });
  const tx = await pool.connect();
  try {
    await tx.query('BEGIN');
    const role = await tx.query<{ unsafe: boolean }>('SELECT rolsuper OR rolbypassrls AS unsafe FROM pg_roles WHERE rolname=current_user');
    if (role.rows[0]?.unsafe !== false) throw new Error('Module runtime role must enforce row security');
    await tx.query("SELECT set_config('app.tenant_id',$1,true)", [tenantId]);
    const result = await work(tx);
    await tx.query('COMMIT');
    return result;
  } catch (error) { await tx.query('ROLLBACK'); throw error; }
  finally { tx.release(); }
}

export async function rows<T = Record<string, unknown>>(tx: Tx, sql: string, values: unknown[] = []): Promise<T[]> {
  return (await tx.query(sql, values)).rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), value]))) as T[];
}
export async function one<T = Record<string, unknown>>(tx: Tx, sql: string, values: unknown[] = []): Promise<T | undefined> {
  return (await rows<T>(tx, sql, values))[0];
}
