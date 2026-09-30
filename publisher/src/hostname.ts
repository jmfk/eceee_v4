import { normalizeHostname } from './model';

/**
 * Map explicitly configured test hostnames to existing published sites.
 * The browser-facing hostname remains unchanged for links and form redirects.
 */
export function contentHostname(requestHostname: string): string {
  const request = normalizeHostname(requestHostname);
  const mappings = process.env.PUBLISHER_TEST_HOST_MAPPINGS ?? '';

  if (!request) return requestHostname;

  for (const entry of mappings.split(',')) {
    const [testValue, sourceValue, ...extra] = entry.split('=');
    if (extra.length > 0) continue;

    const test = normalizeHostname(testValue ?? '');
    const source = normalizeHostname(sourceValue ?? '');
    if (test && source && request === test) return source;
  }

  return requestHostname;
}
