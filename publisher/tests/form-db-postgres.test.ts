import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkFormSubmissionStore } from '../src/form-db';

const testDatabaseUrl = process.env.PUBLISHER_SQL_TEST_DATABASE_URL ?? '';
let fixtureClient: Client;

describe.skipIf(!testDatabaseUrl)('form readiness SQL against PostgreSQL', () => {
  beforeAll(async () => {
    const target = new URL(testDatabaseUrl);
    if (target.hostname !== '127.0.0.1' || target.pathname !== '/eceee_publisher_sqltest' || target.username !== 'postgres') {
      throw new Error('The form readiness SQL test requires its dedicated local PostgreSQL database');
    }

    process.env.PUBLISHER_FORM_DATABASE_URL = testDatabaseUrl;
    fixtureClient = new Client({ connectionString: testDatabaseUrl });
    await fixtureClient.connect();
    await fixtureClient.query(`
      CREATE TABLE IF NOT EXISTS webpages_publicformsubmission (
        id uuid, tenant_id uuid, page_id bigint, page_version_id bigint,
        widget_id text, form_title text, data jsonb, submitted_at timestamptz
      )
    `);
  });

  afterAll(async () => {
    await fixtureClient?.end();
  });

  it('executes the production readiness query without a PostgreSQL syntax error', async () => {
    // This fixture uses postgres rather than the restricted writer, so readiness must be false.
    await expect(checkFormSubmissionStore()).rejects.toThrow('Form submission database privileges are not ready');
  });
});
