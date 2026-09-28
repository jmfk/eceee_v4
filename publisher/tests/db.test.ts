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
  });

  it('selects the exact host before wildcard/default inside one read-only snapshot', async () => {
    await database.withSnapshot(reader => reader.root('example.org'));

    expect(mocks.query.mock.calls[0][0]).toBe('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const [rootSql, parameters] = mocks.query.mock.calls[1];
    expect(rootSql).toContain('hostnames @> ARRAY[$1]::varchar[]');
    expect(rootSql).toContain("hostnames && ARRAY['*', 'default']::varchar[]");
    expect(rootSql).toContain('CASE WHEN hostnames @> ARRAY[$1]::varchar[] THEN 0 ELSE 1 END');
    expect(parameters).toEqual(['example.org']);
    expect(mocks.query.mock.calls[2][0]).toBe('COMMIT');
    expect(mocks.release).toHaveBeenCalledOnce();
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
