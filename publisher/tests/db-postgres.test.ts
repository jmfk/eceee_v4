import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { database } from '../src/db';

const testDatabaseUrl = process.env.PUBLISHER_SQL_TEST_DATABASE_URL ?? '';
let fixtureClient: Client;

describe.skipIf(!testDatabaseUrl)('hostname root lookup against PostgreSQL', () => {
  beforeAll(async () => {
    const target = new URL(testDatabaseUrl);
    if (target.hostname !== '127.0.0.1' || target.pathname !== '/eceee_publisher_sqltest' || target.username !== 'postgres') {
      throw new Error('Hostname lookup tests require the dedicated local PostgreSQL database');
    }

    process.env.PUBLISHER_DATABASE_URL = testDatabaseUrl;
    fixtureClient = new Client({ connectionString: testDatabaseUrl });
    await fixtureClient.connect();
    await fixtureClient.query(`
      CREATE TABLE IF NOT EXISTS webpages_webpage (
        id bigint PRIMARY KEY, tenant_id bigint NOT NULL, parent_id bigint,
        slug text NOT NULL, title text NOT NULL, hostnames varchar[] NOT NULL,
        path_pattern text NOT NULL DEFAULT '', enable_css_injection boolean NOT NULL DEFAULT true,
        page_css_variables jsonb NOT NULL DEFAULT '{}', page_custom_css text NOT NULL DEFAULT '',
        is_deleted boolean NOT NULL DEFAULT false, sort_order integer NOT NULL DEFAULT 0
      )
    `);
    await fixtureClient.query(`
      INSERT INTO webpages_webpage (id, tenant_id, slug, title, hostnames) VALUES
        (910001, 1, 'exact', 'Exact', ARRAY['summerstudy-test.colliberty.com']),
        (910002, 1, 'wildcard', 'Wildcard', ARRAY['*.colliberty.com']),
        (910003, 1, 'nested', 'Nested', ARRAY['*.test.colliberty.com'])
      ON CONFLICT (id) DO NOTHING
    `);
  });

  afterAll(async () => {
    if (fixtureClient) {
      await fixtureClient.query('DELETE FROM webpages_webpage WHERE id IN (910001, 910002, 910003)');
      await fixtureClient.end();
    }
  });

  it('prefers exact and more specific scoped wildcards and excludes the apex', async () => {
    expect((await database.withSnapshot(reader => reader.root('summerstudy-test.colliberty.com')))?.id).toBe('910001');
    expect((await database.withSnapshot(reader => reader.root('news.test.colliberty.com')))?.id).toBe('910003');
    expect((await database.withSnapshot(reader => reader.root('news.colliberty.com')))?.id).toBe('910002');
    expect(await database.withSnapshot(reader => reader.root('colliberty.com'))).toBeNull();
  });
});
