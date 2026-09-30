import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const query = vi.fn();
  const release = vi.fn();
  const connect = vi.fn(async () => ({ query, release }));
  return { query, release, connect };
});

vi.mock('pg', () => ({ Pool: class { connect = mocks.connect; } }));

import { checkFormSubmissionStore, formSubmissions } from '../src/form-db';

const submission = {
  tenantId: 'b62c7810-cdde-4dc4-b255-64ce51daf465',
  pageId: '42',
  versionId: '100',
  widgetId: 'contact-form',
  formTitle: 'Contact us',
  data: { email: 'visitor@example.org' },
};

describe('form submission database', () => {
  beforeEach(() => {
    process.env.PUBLISHER_FORM_DATABASE_URL = 'postgresql://forms.invalid/eceee';
    mocks.query.mockReset();
    mocks.release.mockReset();
    mocks.connect.mockClear();
    mocks.query.mockImplementation(async (sql: string) => sql.includes('COUNT(submitted_at)')
      ? { rows: [{ count: 0 }] }
      : { rows: [] });
  });

  it('serializes the per-form rate check and inserts server-owned identifiers', async () => {
    await expect(formSubmissions.insert(submission)).resolves.toBe('stored');

    expect(mocks.query.mock.calls.map(call => String(call[0]).trim().split(/\s+/, 1)[0])).toEqual([
      'BEGIN',
      'SELECT',
      'SELECT',
      'INSERT',
      'COMMIT',
    ]);
    expect(mocks.query.mock.calls[1][0]).toContain('pg_advisory_xact_lock');
    expect(mocks.query.mock.calls[2][0]).toContain('COUNT(submitted_at)');
    expect(mocks.query.mock.calls[2][1]).toEqual([submission.tenantId, submission.pageId, submission.widgetId]);
    const insertParameters = mocks.query.mock.calls[3][1];
    expect(insertParameters.slice(1)).toEqual([
      submission.tenantId,
      submission.pageId,
      submission.versionId,
      submission.widgetId,
      submission.formTitle,
      JSON.stringify(submission.data),
    ]);
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it('does not insert after the per-form minute limit is reached', async () => {
    mocks.query.mockImplementation(async (sql: string) => sql.includes('COUNT(submitted_at)')
      ? { rows: [{ count: 30 }] }
      : { rows: [] });

    await expect(formSubmissions.insert(submission)).resolves.toBe('rate_limited');

    expect(mocks.query.mock.calls.some(call => String(call[0]).includes('INSERT INTO'))).toBe(false);
    expect(mocks.query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });

  it('rolls back and releases the client when insertion fails', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(submitted_at)')) return { rows: [{ count: 0 }] };
      if (sql.includes('INSERT INTO')) throw new Error('insert failed');
      return { rows: [] };
    });

    await expect(formSubmissions.insert(submission)).rejects.toThrow('insert failed');

    expect(mocks.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it('accepts an available writer with the exact effective privileges', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ ready: true }] });

    await expect(checkFormSubmissionStore()).resolves.toBeUndefined();

    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.query.mock.calls[0][0]).toContain("current_user = 'eceee_publisher_forms'");
    expect(mocks.query.mock.calls[0][0]).toContain('has_column_privilege');
    expect(mocks.query.mock.calls[0][0]).toContain('TRUNCATE, REFERENCES, TRIGGER');
    expect(mocks.query.mock.calls[0][0]).toContain('has_any_column_privilege');
    expect(mocks.query.mock.calls[0][0]).toContain('UPDATE, REFERENCES');
    expect(mocks.query.mock.calls[0][0]).toContain('rolbypassrls');
    expect(mocks.query.mock.calls[0][0]).toContain('pg_auth_members');
    expect(mocks.query.mock.calls[0][0]).toContain('has_function_privilege');
    expect(mocks.query.mock.calls[0][0]).toContain('has_sequence_privilege');
    expect(mocks.query.mock.calls[0][0]).toContain("current_database(), 'CREATE'");
    expect(mocks.query.mock.calls[0][0]).toContain('FROM pg_attribute AS attribute, form_table');
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it('rejects writer privilege drift and releases the connection', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ ready: false }] });

    await expect(checkFormSubmissionStore()).rejects.toThrow('privileges are not ready');

    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it('releases the writer connection when the readiness query fails', async () => {
    mocks.query.mockRejectedValueOnce(new Error('connection lost'));

    await expect(checkFormSubmissionStore()).rejects.toThrow('connection lost');

    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
