import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { FormSubmissionStore, StoredFormSubmission } from './forms';

const MAX_SUBMISSIONS_PER_MINUTE = 30;
let pool: Pool | undefined;

function connection(): Pool {
  if (!process.env.PUBLISHER_FORM_DATABASE_URL) throw new Error('PUBLISHER_FORM_DATABASE_URL is required');
  return pool ??= new Pool({
    connectionString: process.env.PUBLISHER_FORM_DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 5000,
    options: '-c statement_timeout=5000',
  });
}

export async function checkFormSubmissionStore(): Promise<void> {
  const client = await connection().connect();
  try {
    const result = await client.query<{ ready: boolean }>(`
      WITH publisher_role AS (
        SELECT oid, rolcanlogin, rolsuper, rolinherit, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
        FROM pg_roles
        WHERE rolname = current_user
      ), application_schemas AS (
        SELECT oid, nspname, nspowner
        FROM pg_namespace
        WHERE nspname NOT IN ('pg_catalog', 'information_schema')
          AND nspname NOT LIKE 'pg_toast%'
          AND nspname NOT LIKE 'pg_temp_%'
      ), form_table AS (
        SELECT 'public.webpages_publicformsubmission'::regclass AS oid
      )
      SELECT
        current_user = 'eceee_publisher_forms'
        AND EXISTS (
          SELECT 1
          FROM publisher_role
          WHERE rolcanlogin
            AND NOT rolsuper
            AND NOT rolinherit
            AND NOT rolcreatedb
            AND NOT rolcreaterole
            AND NOT rolreplication
            AND NOT rolbypassrls
        )
        AND NOT EXISTS (
          SELECT 1
          FROM pg_auth_members AS membership, publisher_role
          WHERE membership.member = publisher_role.oid OR membership.roleid = publisher_role.oid
        )
        AND NOT EXISTS (
          SELECT 1 FROM pg_database AS database, publisher_role
          WHERE database.datname = current_database() AND database.datdba = publisher_role.oid
          UNION ALL
          SELECT 1 FROM application_schemas AS namespace, publisher_role
          WHERE namespace.nspowner = publisher_role.oid
          UNION ALL
          SELECT 1
          FROM pg_class AS relation, application_schemas AS namespace, publisher_role
          WHERE relation.relnamespace = namespace.oid AND relation.relowner = publisher_role.oid
          UNION ALL
          SELECT 1
          FROM pg_proc AS routine, application_schemas AS namespace, publisher_role
          WHERE routine.pronamespace = namespace.oid AND routine.proowner = publisher_role.oid
        )
        AND has_database_privilege(current_user, current_database(), 'CONNECT')
        -- TEMP remains a PostgreSQL PUBLIC default; database CREATE must never be effective.
        AND NOT has_database_privilege(current_user, current_database(), 'CREATE')
        AND has_schema_privilege(current_user, 'public', 'USAGE')
        AND NOT has_schema_privilege(current_user, 'public', 'CREATE')
        AND NOT EXISTS (
          SELECT 1
          FROM application_schemas
          WHERE nspname <> 'public'
            AND has_schema_privilege(current_user, oid, 'USAGE, CREATE')
        )
        AND NOT EXISTS (
          SELECT 1
          FROM pg_class AS relation, application_schemas AS namespace, form_table
          WHERE relation.relnamespace = namespace.oid
            AND relation.oid <> form_table.oid
            AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
            AND (
              has_table_privilege(
                current_user,
                relation.oid,
                'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
              )
              OR has_any_column_privilege(current_user, relation.oid, 'SELECT, INSERT, UPDATE, REFERENCES')
            )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM pg_class AS sequence, application_schemas AS namespace
          WHERE sequence.relnamespace = namespace.oid
            AND sequence.relkind = 'S'
            AND has_sequence_privilege(current_user, sequence.oid, 'USAGE, SELECT, UPDATE')
        )
        AND NOT EXISTS (
          SELECT 1
          FROM pg_proc AS routine, application_schemas AS namespace
          WHERE routine.pronamespace = namespace.oid
            AND has_function_privilege(current_user, routine.oid, 'EXECUTE')
        )
        AND NOT has_table_privilege(current_user, 'public.webpages_publicformsubmission', 'SELECT')
        AND NOT has_table_privilege(current_user, 'public.webpages_publicformsubmission', 'INSERT')
        AND NOT has_table_privilege(
          current_user,
          'public.webpages_publicformsubmission',
          'UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
        )
        AND NOT has_any_column_privilege(
          current_user,
          'public.webpages_publicformsubmission',
          'UPDATE, REFERENCES'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM pg_attribute AS attribute, form_table
          WHERE attribute.attrelid = form_table.oid
            AND attribute.attnum > 0
            AND NOT attribute.attisdropped
            AND attribute.attname <> ALL (ARRAY['tenant_id', 'page_id', 'widget_id', 'submitted_at'])
            AND has_column_privilege(current_user, form_table.oid, attribute.attname, 'SELECT')
        )
        AND NOT EXISTS (
          SELECT 1
          FROM pg_attribute AS attribute, form_table
          WHERE attribute.attrelid = form_table.oid
            AND attribute.attnum > 0
            AND NOT attribute.attisdropped
            AND attribute.attname <> ALL (
              ARRAY['id', 'tenant_id', 'page_id', 'page_version_id', 'widget_id', 'form_title', 'data', 'submitted_at']
            )
            AND has_column_privilege(current_user, form_table.oid, attribute.attname, 'INSERT')
        )
        AND has_column_privilege(current_user, 'public.webpages_publicformsubmission', 'tenant_id', 'SELECT')
        AND has_column_privilege(current_user, 'public.webpages_publicformsubmission', 'page_id', 'SELECT')
        AND has_column_privilege(current_user, 'public.webpages_publicformsubmission', 'widget_id', 'SELECT')
        AND has_column_privilege(current_user, 'public.webpages_publicformsubmission', 'submitted_at', 'SELECT')
        AND NOT has_column_privilege(current_user, 'public.webpages_publicformsubmission', 'id', 'SELECT')
        AND NOT has_column_privilege(current_user, 'public.webpages_publicformsubmission', 'page_version_id', 'SELECT')
        AND NOT has_column_privilege(current_user, 'public.webpages_publicformsubmission', 'form_title', 'SELECT')
        AND NOT has_column_privilege(current_user, 'public.webpages_publicformsubmission', 'data', 'SELECT')
        AND has_column_privilege(current_user, 'public.webpages_publicformsubmission', 'id', 'INSERT')
        AND has_column_privilege(current_user, 'public.webpages_publicformsubmission', 'tenant_id', 'INSERT')
        AND has_column_privilege(current_user, 'public.webpages_publicformsubmission', 'page_id', 'INSERT')
        AND has_column_privilege(current_user, 'public.webpages_publicformsubmission', 'page_version_id', 'INSERT')
        AND has_column_privilege(current_user, 'public.webpages_publicformsubmission', 'widget_id', 'INSERT')
        AND has_column_privilege(current_user, 'public.webpages_publicformsubmission', 'form_title', 'INSERT')
        AND has_column_privilege(current_user, 'public.webpages_publicformsubmission', 'data', 'INSERT')
        AND has_column_privilege(current_user, 'public.webpages_publicformsubmission', 'submitted_at', 'INSERT')
        AS ready
    `);
    if (result.rows[0]?.ready !== true) throw new Error('Form submission database privileges are not ready');
  } finally {
    client.release();
  }
}

export const formSubmissions: FormSubmissionStore = {
  async insert(submission: StoredFormSubmission): Promise<'stored' | 'rate_limited'> {
    const client = await connection().connect();
    const lockKey = `${submission.tenantId}:${submission.pageId}:${submission.widgetId}`;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [lockKey]);
      const recent = await client.query<{ count: number }>(
        `SELECT COUNT(submitted_at)::int AS count
           FROM webpages_publicformsubmission
          WHERE tenant_id = $1 AND page_id = $2 AND widget_id = $3
            AND submitted_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute'`,
        [submission.tenantId, submission.pageId, submission.widgetId],
      );
      if ((recent.rows[0]?.count ?? 0) >= MAX_SUBMISSIONS_PER_MINUTE) {
        await client.query('COMMIT');
        return 'rate_limited';
      }
      await client.query(
        `INSERT INTO webpages_publicformsubmission
          (id, tenant_id, page_id, page_version_id, widget_id, form_title, data, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, CURRENT_TIMESTAMP)`,
        [
          randomUUID(),
          submission.tenantId,
          submission.pageId,
          submission.versionId,
          submission.widgetId,
          submission.formTitle,
          JSON.stringify(submission.data),
        ],
      );
      await client.query('COMMIT');
      return 'stored';
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  },
};
