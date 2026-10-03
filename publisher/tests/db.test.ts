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
    delete process.env.PUBLISHER_MEDIA_BASE_URL;
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
    expect(navigationSql).toContain("published.page_data->'shortTitle'");
    expect(navigationSql).toContain("published.page_data->'short_title'");
    expect(fileSql).toContain("media.access_level = 'public'");
    expect(fileSql).toContain('media.tenant_id = $2');
    expect(collectionSql).toContain("collection.access_level = 'public'");
    expect(collectionSql).toContain('namespace.tenant_id = $2');
    expect(collectionSql).toContain('media.is_deleted = false');
  });

  it('derives public media URLs from file paths when the legacy URL column is empty', async () => {
    process.env.PUBLISHER_MEDIA_BASE_URL = 'https://media.example/public-bucket/';
    mocks.query.mockImplementation(async sql => {
      const statement = String(sql);
      if (statement.includes('FROM file_manager_mediafile AS media')) return { rows: [{
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', url: '', file_path: 'uploads/hero image.jpg',
        type: 'image', altText: 'Hero', caption: '', annotation: '', title: 'Hero',
        width: 1200, height: 800, thumbnailUrl: '',
      }] };
      if (statement.includes('FROM file_manager_mediafile_collections AS membership')) return { rows: [{
        collection_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', url: '', file_path: 'uploads/logo.svg',
        type: 'image', altText: 'Logo', caption: '', annotation: '', title: 'Logo',
        width: 200, height: 100, thumbnailUrl: '',
      }] };
      return { rows: [] };
    });

    const media = await database.withSnapshot(reader => reader.publicMedia(
      ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      '7',
    ));

    expect(media.files[0]).toMatchObject({
      url: 'https://media.example/public-bucket/uploads/hero%20image.jpg',
      thumbnailUrl: 'https://media.example/public-bucket/uploads/hero%20image.jpg',
    });
    expect(media.collections['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'][0]).toMatchObject({
      url: 'https://media.example/public-bucket/uploads/logo.svg',
      thumbnailUrl: 'https://media.example/public-bucket/uploads/logo.svg',
    });
    expect(mocks.query.mock.calls[1][0]).toContain('media.file_path');
  });

  it('honors both directions of the supported updated_at object ordering', async () => {
    await database.withSnapshot(async reader => {
      await reader.publishedObjects({ objectTypeNames: ['article'], limit: 5, sortOrder: 'updated_at' }, '7', new Date('2026-06-01'));
      await reader.publishedObjects({ objectTypeNames: ['article'], limit: 5, sortOrder: '-updated_at' }, '7', new Date('2026-06-01'));
    });

    expect(mocks.query.mock.calls[1][0]).toContain('ORDER BY object.updated_at, object.id');
    expect(mocks.query.mock.calls[2][0]).toContain('ORDER BY object.updated_at DESC, object.id DESC');
  });

  it('prioritizes the same instance metadata flags as Django top-news widgets', async () => {
    await database.withSnapshot(reader => reader.publishedObjects({
      objectTypeNames: ['article'], limit: 5, sortOrder: '-publish_date', pinnedFirst: true,
    }, '7', new Date('2026-06-01')));

    const sql = mocks.query.mock.calls[1][0];
    expect(sql).toContain(`object.metadata @> '{"pinned": true}'::jsonb`);
    expect(sql).toContain(`object.metadata @> '{"featured": true}'::jsonb`);
    expect(sql).not.toContain('ORDER BY published.is_featured DESC');
  });

  it('drops numeric object IDs outside the PostgreSQL bigint range', async () => {
    const objects = await database.withSnapshot(reader => reader.publishedObjects({
      objectIds: ['99999999999999999999'], limit: 1, sortOrder: '-publish_date',
    }, '7', new Date('2026-06-01')));

    expect(objects).toEqual([]);
    expect(mocks.query.mock.calls.map(call => call[0])).toEqual([
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      'COMMIT',
    ]);
  });

  it('loads tenant-scoped published hierarchy only when requested', async () => {
    await database.withSnapshot(async reader => {
      await reader.publishedObjects({ objectTypeNames: ['article'], limit: 1, sortOrder: '-publish_date', includeHierarchy: true }, '7', new Date('2026-06-01'));
    });

    const [sql, parameters] = mocks.query.mock.calls[1];
    expect(sql).toContain('CASE WHEN $8::boolean');
    expect(sql).toContain('ancestor.tenant_id = $1');
    expect(sql).toContain('parent.id = object.parent_id AND parent.tenant_id = $1');
    expect(sql).toContain('parent_version.effective_date <= $4');
    expect(sql).toContain('child.tenant_id = $1 AND child.parent_id = object.id');
    expect(sql).toContain('child_version.effective_date <= $4');
    expect(sql).toContain('object.created_at::text AS "createdAt"');
    expect(sql).toContain('object.updated_at::text AS "updatedAt"');
    expect(parameters[7]).toBe(true);
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
