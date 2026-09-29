import { NextResponse } from 'next/server';
import { database } from '@/src/db';
import { formSubmissions } from '@/src/form-db';
import { submitPublishedForm } from '@/src/forms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 64 * 1024;
type RouteContext = { params: Promise<{ pageId: string; widgetId: string }> };

async function readBody(request: Request): Promise<string | null> {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

function redirectToPage(request: Request, path: string, widgetId: string, status: 'success' | 'error') {
  const target = new URL(path, request.url);
  target.searchParams.set('form_status', status);
  target.searchParams.set('form_widget', widgetId);
  return NextResponse.redirect(target, 303);
}

export async function POST(request: Request, context: RouteContext) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return new Response('Cross-site form submissions are not accepted.', { status: 403 });
  }
  const { pageId, widgetId } = await context.params;
  if (!/^\d{1,19}$/.test(pageId)
      || BigInt(pageId) > 9_223_372_036_854_775_807n
      || widgetId.length < 1
      || widgetId.length > 255) {
    return new Response('Published form not found.', { status: 404 });
  }
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded') {
    return new Response('Unsupported form encoding.', { status: 415 });
  }
  const body = await readBody(request);
  if (body === null) return new Response('Form submission is too large.', { status: 413 });

  const submitted = new URLSearchParams(body);
  const pagePaths = submitted.getAll('__page_path');
  if (pagePaths.length !== 1 || pagePaths[0].length > 2048) return new Response('Invalid form target.', { status: 400 });
  const values: Record<string, string[]> = {};
  for (const [name, value] of submitted.entries()) {
    values[name] = [...(values[name] ?? []), value];
  }

  try {
    const result = await submitPublishedForm({
      readDb: database,
      store: formSubmissions,
      hostname: request.headers.get('host') || '',
      pageId,
      widgetId,
      pagePath: pagePaths[0],
      values,
      honeypot: submitted.get('__website') || '',
    });
    if (result.status === 'not_found') return new Response('Published form not found.', { status: 404 });
    return redirectToPage(request, result.redirectPath, widgetId, result.status === 'success' ? 'success' : 'error');
  } catch (error) {
    console.error('[public-form] submission failed', error instanceof Error ? error.name : 'UnknownError');
    return new Response('Form submission is temporarily unavailable.', { status: 503 });
  }
}
