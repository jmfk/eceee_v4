import type { Instrumentation } from 'next';

export const onRequestError: Instrumentation.onRequestError = (error) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // This publisher is a long-lived Node server. Keep best-effort telemetry out
  // of Next's awaited error-response path; the transport handles its own timeout.
  void import('./src/slack-errors')
    .then(({ reportPublisherError }) => reportPublisherError(error))
    .catch(() => undefined);
};
