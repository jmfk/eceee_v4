import { normalizeHostname } from './model';

/** Resolve published content by the request hostname, including test aliases. */
export function contentHostname(requestHostname: string): string {
  return normalizeHostname(requestHostname) ?? requestHostname;
}
