import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ checkFormSubmissionStore: vi.fn() }));
vi.mock('@/src/form-db', () => ({ checkFormSubmissionStore: mocks.checkFormSubmissionStore }));

import { GET } from '../app/api/health/route';

describe('publisher health route', () => {
  beforeEach(() => {
    mocks.checkFormSubmissionStore.mockReset();
    mocks.checkFormSubmissionStore.mockResolvedValue(undefined);
  });

  it('returns a non-cacheable publisher marker for the public routing probe', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-eceee-publisher')).toBe('nextjs');
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('returns 503 when the form writer is unavailable', async () => {
    mocks.checkFormSubmissionStore.mockRejectedValueOnce(new Error('connection failed'));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-eceee-publisher')).toBe('nextjs');
    await expect(response.json()).resolves.toEqual({ status: 'unavailable' });
  });
});
