import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const query = vi.fn();
  const release = vi.fn();
  const connect = vi.fn(async () => ({ query, release }));
  return { query, release, connect };
});

vi.mock('pg', () => ({ Pool: class { connect = mocks.connect; } }));

import { database } from '../src/db';

describe('database snapshot', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.release.mockReset();
    mocks.connect.mockClear();
    mocks.query.mockResolvedValue({ rows: [] });
    process.env.PUBLISHER_DATABASE_URL = 'postgresql://publisher.invalid/eceee';
    delete process.env.PUBLISHER_ALLOW_WILDCARD_HOSTNAMES;
    delete process.env.PUBLISHER_DEFAULT_HOSTNAMES;
  });

  it('selects exact hosts while fallback routing is denied by default', async () => {
    await database.withSnapshot(reader => reader.root('example.org'));

    expect(mocks.query.mock.calls[0][0]).toBe('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const [rootSql, parameters] = mocks.query.mock.calls[1];
    expect(rootSql).toContain('hostnames @> ARRAY[$1]::varchar[]');
    expect(rootSql).toContain('hostnames && $2::varchar[]');
    expect(rootSql).toContain("$3::boolean AND hostnames @> ARRAY['*']::varchar[]");
    expect(rootSql).toContain("$4::boolean AND hostnames @> ARRAY['default']::varchar[]");
    expect(parameters).toEqual(['example.org', [], false, false]);
    expect(mocks.query.mock.calls[2][0]).toBe('COMMIT');
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it('enables wildcard and default routing only through explicit configuration', async () => {
    process.env.PUBLISHER_ALLOW_WILDCARD_HOSTNAMES = 'true';
    process.env.PUBLISHER_DEFAULT_HOSTNAMES = ' preview.example.org:8443, default, * ';

    await database.withSnapshot(reader => reader.root('preview.example.org'));

    expect(mocks.query.mock.calls[1][1]).toEqual(['preview.example.org', ['*.example.org'], true, true]);
  });

  it('orders scoped wildcard aliases from the most specific suffix, after exact matches', async () => {
    await database.withSnapshot(reader => reader.root('news.preview.example.org'));

    const [rootSql, parameters] = mocks.query.mock.calls[1];
    expect(parameters).toEqual(['news.preview.example.org', ['*.preview.example.org', '*.example.org'], false, false]);
    expect(rootSql).toContain('MIN(array_position($2::varchar[], candidate))');
    expect(rootSql).toContain('WHEN hostnames && $2::varchar[] THEN 1 ELSE 2');
  });

  it('keeps explicit and default theme reads tenant-scoped', async () => {
    await database.withSnapshot(async reader => {
      await reader.theme('20', '7');
      await reader.defaultTheme('7');
    });

    const [themeSql, themeParameters] = mocks.query.mock.calls[1];
    const [defaultSql, defaultParameters] = mocks.query.mock.calls[2];
    expect(themeSql).toContain('id = $1 AND tenant_id = $2');
    expect(themeParameters).toEqual(['20', '7']);
    expect(defaultSql).toContain('tenant_id = $1 AND is_default = true AND is_active = true');
    expect(defaultParameters).toEqual(['7']);
  });

  it('keeps page references and public collection media tenant and site scoped', async () => {
    await database.withSnapshot(async reader => {
      await reader.publishedPageReferences(['10'], '7', '1', new Date('2026-06-01'));
      await reader.publishedNavigationPages(['10'], '7', '1', new Date('2026-06-01'));
      await reader.publicMedia(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'], ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'], '7');
    });

    const pageSql = mocks.query.mock.calls[1][0];
    const navigationSql = mocks.query.mock.calls[2][0];
    const fileSql = mocks.query.mock.calls[3][0];
    const collectionSql = mocks.query.mock.calls[4][0];
    expect(pageSql).toContain('page.tenant_id = $2');
    expect(pageSql).toContain('page.cached_root_id = $3');
    expect(pageSql).toContain('version.effective_date <= $4');
    expect(navigationSql).toContain('page.parent_id = ANY($1::bigint[])');
    expect(navigationSql).toContain('page.tenant_id = $2');
    expect(navigationSql).toContain('page.cached_root_id = $3');
    expect(fileSql).toContain("media.access_level = 'public'");
    expect(fileSql).toContain('media.tenant_id = $2');
    expect(collectionSql).toContain("collection.access_level = 'public'");
    expect(collectionSql).toContain('namespace.tenant_id = $2');
    expect(collectionSql).toContain('media.is_deleted = false');
  });

  it('rolls back and releases the client when resolution fails', async () => {
    const failure = new Error('resolution failed');
    await expect(database.withSnapshot(async () => { throw failure; })).rejects.toBe(failure);

    expect(mocks.query.mock.calls.map(call => call[0])).toEqual([
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      'ROLLBACK',
    ]);
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
