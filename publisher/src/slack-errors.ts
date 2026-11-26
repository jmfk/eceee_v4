// Server-only: never import from a client component or include request/exception text.
import { after } from 'next/server';

type Source = 'request' | 'editorial' | 'news-preview' | 'public-form' | 'health' | 'theme-error';
type State = 'disabled' | 'configuration_error' | 'deduplicated' | 'sent' | 'rate_limited' | 'uncertain';
const errorNames = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'AggregateError']);
const sources = new Set<Source>(['request', 'editorial', 'news-preview', 'public-form', 'health', 'theme-error']);
const recent = new Map<string, number>();
const webhookPattern = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/;

export async function reportPublisherError(error: unknown, source: Source = 'request'): Promise<State> {
  if (!['true', '1', 'yes', 'on'].includes((process.env.SLACK_SERVER_ERRORS_ENABLED || '').toLowerCase())) return 'disabled';
  const webhook = process.env.SLACK_SERVER_WEBHOOK_URL || '';
  if (!webhookPattern.test(webhook) || webhook.trim() !== webhook) return 'configuration_error';

  try {
    const name = error instanceof Error && errorNames.has(error.name) ? error.name : 'Error';
    const origin = sources.has(source) ? source : 'request';
    const version = process.env.APP_VERSION || 'unknown';
    const release = /^[A-Za-z0-9._-]{1,80}$/.test(version) ? version : 'unknown';
    const configuredEnvironment = process.env.SLACK_ENVIRONMENT || 'production';
    const environment = ['development', 'staging', 'production'].includes(configuredEnvironment) ? configuredEnvironment : 'unknown';
    const key = `${origin}:${name}:${release}`;
    const now = Date.now();
    for (const [group, until] of recent) if (until <= now) recent.delete(group);
    if ((recent.get(key) || 0) > now || recent.size >= 1000) return 'deduplicated';
    recent.set(key, now + 600_000);

    const text = `ECEEE serverfel · publisher · ${name}\nKälla: ${origin}\nMiljö: ${environment} · Version: ${release}`;
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, blocks: [{ type: 'section', text: { type: 'plain_text', text } }], unfurl_links: false, unfurl_media: false }),
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 429) {
      const header = response.headers.get('retry-after') || '60';
      const delay = /^\d{1,6}$/.test(header) ? Math.min(3600, Math.max(1, Number(header))) : 60;
      recent.set(key, now + delay * 1000);
      await response.body?.cancel();
      return 'rate_limited';
    }
    if (response.status !== 200 || !response.body) {
      await response.body?.cancel();
      return 'uncertain';
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let body = '';
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 32) {
        await reader.cancel();
        return 'uncertain';
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode() === 'ok' ? 'sent' : 'uncertain';
  } catch {
    // A timeout can follow acceptance. Never print a credential-bearing transport error or blindly retry it.
    return 'uncertain';
  }
}

export function schedulePublisherError(error: unknown, source: Source): void {
  try {
    after(async () => { await reportPublisherError(error, source); });
  } catch {
    // Unit/build contexts have no request lifecycle. Notification must not change route behavior.
  }
}
