import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ report: vi.fn() }));
vi.mock('../src/slack-errors', () => ({ reportPublisherError: mocks.report }));
import { onRequestError } from '../instrumentation';

const request = { path: '/private?token=not-forwarded', method: 'GET', headers: {} };
const context = { routerKind: 'App Router' as const, routePath: '/[[...slug]]', routeType: 'render' as const, revalidateReason: undefined };

describe('publisher error instrumentation', () => {
  beforeEach(() => { mocks.report.mockReset(); vi.stubEnv('NEXT_RUNTIME', 'nodejs'); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('returns immediately while Slack is still pending and does not forward request context', async () => {
    mocks.report.mockReturnValue(new Promise(() => undefined));
    const error = new TypeError('not forwarded as text');
    expect(onRequestError(error, request, context)).toBeUndefined();
    await vi.waitFor(() => expect(mocks.report).toHaveBeenCalledWith(error));
  });

  it('contains reporter rejection without rejecting the error-response hook', async () => {
    mocks.report.mockRejectedValue(new Error('transport unavailable'));
    expect(onRequestError(new Error(), request, context)).toBeUndefined();
    await vi.waitFor(() => expect(mocks.report).toHaveBeenCalledTimes(1));
  });

  it('does not load Node telemetry in the edge runtime', () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    expect(onRequestError(new Error(), request, context)).toBeUndefined();
    expect(mocks.report).not.toHaveBeenCalled();
  });
});
