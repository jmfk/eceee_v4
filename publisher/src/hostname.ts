import { normalizeHostname } from './model';

/**
 * Map one explicitly configured test hostname to an existing published site.
 * The browser-facing hostname remains unchanged for links and form redirects.
 */
export function contentHostname(requestHostname: string): string {
  const request = normalizeHostname(requestHostname);
  const test = normalizeHostname(process.env.PUBLISHER_TEST_DOMAIN ?? '');
  const source = normalizeHostname(process.env.PUBLISHER_TEST_SOURCE_HOST ?? '');

  if (request && test && source && request === test) return source;
  return requestHostname;
}

