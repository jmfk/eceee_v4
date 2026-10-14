import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../proxy';

describe('theme error route proxy', () => {
  it.each([403, 500, 503])('rewrites /%s to the theme renderer and preserves the error status', statusCode => {
    const response = proxy(new NextRequest(`https://example.org/${statusCode}`));

    expect(response.status).toBe(statusCode);
    expect(response.headers.get('x-middleware-rewrite')).toBe(`https://example.org/theme-error-status/${statusCode}`);
  });

  it('leaves ordinary publisher routes unchanged', () => {
    const response = proxy(new NextRequest('https://example.org/news'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('blocks direct access to the internal renderer even with a spoofed dispatch header', () => {
    const response = proxy(new NextRequest('https://example.org/theme-error-status/403', {
      headers: { 'x-eceee-theme-error': '403' },
    }));

    expect(response.status).toBe(404);
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
  });
});
