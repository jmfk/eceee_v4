export class ModuleError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const fail = (status: number, message: string): never => { throw new ModuleError(status, message); };
export function text(value: unknown, name: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) return fail(400, `Invalid ${name}.`);
  return value.trim();
}
export function uuid(value: unknown): string {
  const result = text(value, 'identifier', 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result)) return fail(400, 'Invalid identifier.');
  return result.toLowerCase();
}
export function integer(value: unknown, name: string, min = 1, max = 99999999): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) return fail(400, `Invalid ${name}.`);
  return value;
}
export function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') return fail(400, 'Expected true or false.');
  return value;
}
export function accessKey(value: unknown): string {
  const result = text(value, 'access key', 120);
  if (!/^[a-z0-9][a-z0-9._:-]*$/.test(result)) return fail(400, 'Invalid access key.');
  return result;
}
export function date(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || Date.parse(value) <= Date.now()) return fail(400, 'Expiry must be in the future.');
  return new Date(value).toISOString();
}
export async function body(request: Request, max = 65536): Promise<string> {
  if (Number(request.headers.get('content-length')) > max) return fail(413, 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > max) { await reader.cancel(); return fail(413, 'Request is too large.'); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
export function requestOrigin(request: Request): string {
  const protocol = request.headers.get('x-forwarded-proto') === 'https' || new URL(request.url).protocol === 'https:' ? 'https' : 'http';
  return new URL(`${protocol}://${request.headers.get('host') || new URL(request.url).host}`).origin;
}
export function sameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  let valid = false;
  try { valid = Boolean(origin && new URL(origin).origin === requestOrigin(request)); } catch { /* Invalid and opaque origins fail closed. */ }
  if (!valid || request.headers.get('sec-fetch-site') === 'cross-site') fail(403, 'Use this site to submit changes.');
}
