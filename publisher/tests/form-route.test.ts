import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock('@/src/db', () => ({ database: { kind: 'read-db' } }));
vi.mock('@/src/form-db', () => ({ formSubmissions: { kind: 'write-db' } }));
vi.mock('@/src/forms', () => ({ submitPublishedForm: mocks.submit }));

import { POST } from '../app/api/forms/[pageId]/[widgetId]/route';

const context = { params: Promise.resolve({ pageId: '42', widgetId: 'contact-form' }) };
const request = (body: string, headers: Record<string, string> = {}) => new Request(
  'https://example.org/api/forms/42/contact-form',
  {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      host: 'example.org',
      ...headers,
    },
    body,
  },
);

describe('public form route', () => {
  beforeEach(() => {
    mocks.submit.mockReset();
    mocks.submit.mockResolvedValue({ status: 'success', redirectPath: '/contact' });
    delete process.env.PUBLISHER_TEST_HOST_MAPPINGS;
  });

  it('resolves test content through the source host without changing the browser redirect host', async () => {
    process.env.PUBLISHER_TEST_HOST_MAPPINGS = 'example.org=summerstudy.eceee.org';

    const response = await POST(request('__page_path=%2Fcontact&email=visitor%40example.org'), context);

    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ hostname: 'summerstudy.eceee.org' }));
    expect(response.headers.get('location')).toBe('https://example.org/contact?form_status=success&form_widget=contact-form');
  });

  it('passes urlencoded values to the server-owned form service and redirects after success', async () => {
    const response = await POST(
      request('__page_path=%2Fcontact&email=visitor%40example.org&channels%5B%5D=Email&channels%5B%5D=SMS'),
      context,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://example.org/contact?form_status=success&form_widget=contact-form');
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({
      hostname: 'example.org',
      pageId: '42',
      widgetId: 'contact-form',
      pagePath: '/contact',
      values: expect.objectContaining({
        email: ['visitor@example.org'],
        'channels[]': ['Email', 'SMS'],
      }),
    }));
  });

  it('redirects validation failures to widget-scoped error feedback', async () => {
    mocks.submit.mockResolvedValue({ status: 'invalid', redirectPath: '/contact' });

    const response = await POST(request('__page_path=%2Fcontact&email=invalid'), context);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('form_status=error');
  });

  it('rejects cross-site, unsupported, and oversized requests before resolution', async () => {
    expect((await POST(request('__page_path=%2F', { 'sec-fetch-site': 'cross-site' }), context)).status).toBe(403);
    expect((await POST(request('__page_path=%2F', { 'content-type': 'application/json' }), context)).status).toBe(415);
    expect((await POST(request('__page_path=%2F', { 'content-length': '65537' }), context)).status).toBe(413);
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it('returns 404 without redirecting when the published form does not exist', async () => {
    mocks.submit.mockResolvedValue({ status: 'not_found' });

    const response = await POST(request('__page_path=%2Fcontact'), context);

    expect(response.status).toBe(404);
  });

  it('rejects malformed route identifiers before reading or resolving the form', async () => {
    const response = await POST(
      request('__page_path=%2Fcontact'),
      { params: Promise.resolve({ pageId: 'not-a-page', widgetId: 'contact-form' }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.submit).not.toHaveBeenCalled();
  });
});
