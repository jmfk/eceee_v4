import { describe, expect, it } from 'vitest';

import { GET } from '../app/api/health/route';

describe('publisher health route', () => {
  it('returns a non-cacheable publisher marker for the public routing probe', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-eceee-publisher')).toBe('nextjs');
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});
