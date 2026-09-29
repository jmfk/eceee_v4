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
    options: '-c statement_timeout=5000',
  });
}

export const formSubmissions: FormSubmissionStore = {
  async insert(submission: StoredFormSubmission): Promise<'stored' | 'rate_limited'> {
    const client = await connection().connect();
    const lockKey = `${submission.tenantId}:${submission.pageId}:${submission.widgetId}`;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [lockKey]);
      const recent = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
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
