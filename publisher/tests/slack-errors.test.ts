import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ after: vi.fn() }));
vi.mock('next/server', () => ({ after: mocks.after }));

describe('publisher Slack error notices', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.stubEnv('SLACK_SERVER_ERRORS_ENABLED', 'true');
    vi.stubEnv('SLACK_SERVER_WEBHOOK_URL', 'https://hooks.slack.com/services/TEST/SERVER/fixture');
    vi.stubEnv('APP_VERSION', 'release-test');
    vi.stubEnv('SLACK_ENVIRONMENT', 'staging');
    mocks.after.mockReset();
  });

  it('sends only allowlisted metadata and groups concurrent repeated errors', async () => {
    const send = vi.fn<typeof fetch>().mockImplementation(async () => new Response('ok'));
    vi.stubGlobal('fetch', send);
    const { reportPublisherError } = await import('../src/slack-errors');
    const error = new TypeError('PRIVATE URL https://private.invalid/?token=SECRET');
    await Promise.all([reportPublisherError(error, 'public-form'), reportPublisherError(error, 'public-form')]);
    expect(send).toHaveBeenCalledTimes(1);
    const options = send.mock.calls[0][1]!;
    const text = String(options.body);
    expect(text).toContain('TypeError');
    expect(text).toContain('public-form');
    for (const privateText of ['PRIVATE', 'SECRET', 'private.invalid']) expect(text).not.toContain(privateText);
    expect(options.redirect).toBe('error');
    expect(await reportPublisherError(new Error('other'), 'editorial')).toBe('sent');
  });

  it('does not send without opt-in or to an unapproved host', async () => {
    const send = vi.fn();
    vi.stubGlobal('fetch', send);
    const { reportPublisherError } = await import('../src/slack-errors');
    vi.stubEnv('SLACK_SERVER_ERRORS_ENABLED', 'false');
    expect(await reportPublisherError(new Error())).toBe('disabled');
    vi.stubEnv('SLACK_SERVER_ERRORS_ENABLED', 'true');
    vi.stubEnv('SLACK_SERVER_WEBHOOK_URL', 'https://example.invalid/');
    expect(await reportPublisherError(new Error())).toBe('configuration_error');
    expect(send).not.toHaveBeenCalled();
  });

  it('suppresses retries after a timeout and respects explicit rate-limit rejection', async () => {
    vi.useFakeTimers();
    const send = vi.fn().mockRejectedValueOnce(new Error('PRIVATE')).mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', send);
    const { reportPublisherError } = await import('../src/slack-errors');
    expect(await reportPublisherError(new Error())).toBe('uncertain');
    expect(await reportPublisherError(new Error())).toBe('deduplicated');
    vi.advanceTimersByTime(600_001);
    send.mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '60' } }));
    expect(await reportPublisherError(new Error())).toBe('rate_limited');
    expect(await reportPublisherError(new Error())).toBe('deduplicated');
    vi.advanceTimersByTime(60_001);
    expect(await reportPublisherError(new Error())).toBe('sent');
  });

  it('schedules handled errors after the response and survives a missing lifecycle', async () => {
    mocks.after.mockImplementationOnce(() => { throw new Error('no request'); });
    const { schedulePublisherError } = await import('../src/slack-errors');
    expect(() => schedulePublisherError(new Error(), 'health')).not.toThrow();
    schedulePublisherError(new Error(), 'health');
    expect(mocks.after).toHaveBeenCalledTimes(2);
  });
});
