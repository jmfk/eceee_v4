import type { PublishedObjectQuery } from './model';
import { archiveTypes, type ArchiveKind } from './website';
export type ArchiveQuery = { kind: ArchiveKind; query: PublishedObjectQuery; page: number; text: string; from: string; to: string };
export function archiveQuery(params: URLSearchParams): ArchiveQuery | null {
  const kind = params.get('kind') || 'news';
  const text = (params.get('q') || '').trim();
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const page = Number(params.get('page') || 1);
  const validDate = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number(value.slice(0, 4)) >= 1900 && Number(value.slice(0, 4)) <= 9998
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  try {
    if (!Object.hasOwn(archiveTypes, kind) || text.length > 200 || !validDate(from) || !validDate(to)
      || (from && to && from > to) || !Number.isSafeInteger(page) || page < 1 || page > 10000) return null;
  } catch { return null; }
  const upper = to ? new Date(new Date(`${to}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10) : undefined;
  return { kind: kind as ArchiveKind, page, text, from, to,
    query: { archiveTypeNames: archiveTypes[kind as ArchiveKind], search: text, dateFrom: from || undefined, dateTo: upper,
      dateField: kind === 'events' ? 'event' : 'publication', articleKind: kind === 'news' ? 'news' : undefined,
      limit: 21, offset: (page - 1) * 20, sortOrder: '-publish_date', activeTypeOnly: true } };
}
