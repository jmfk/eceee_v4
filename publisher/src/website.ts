import type { Metadata } from 'next';
import type { PublishedPageModel, ReadDb, Widget } from './model';
import { contentHostname } from './hostname';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function websiteSettings(pageData: unknown) {
  const stored = record(record(pageData).website);
  // Django owns persisted payload names; the UI uses camelCase.
  const data: Record<string, unknown> = { ...stored, noIndex: stored.no_index ?? stored.noIndex,
    shareImageId: stored.share_image_id ?? stored.shareImageId,
    analyticsEnabled: stored.analytics_enabled ?? stored.analyticsEnabled,
    analyticsRequireConsent: stored.analytics_require_consent ?? stored.analyticsRequireConsent };
  const translations = Object.fromEntries(Object.entries(record(data.translations)).filter(([language, id]) =>
    /^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(language) && /^\d{1,19}$/.test(String(id)) && BigInt(String(id)) <= 9_223_372_036_854_775_807n));
  return {
    language: typeof data.language === 'string' && /^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(data.language) ? data.language : '',
    noIndex: data.noIndex === true,
    shareImageId: typeof data.shareImageId === 'string' && /^[0-9a-f-]{36}$/i.test(data.shareImageId) ? data.shareImageId : '',
    translations,
    analyticsEnabled: data.analyticsEnabled === true,
    analyticsRequireConsent: data.analyticsRequireConsent !== false,
  };
}
export function safePath(path: string): string | null {
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\s?#\u0000-\u001f]/.test(path)) return null;
  try { const url = new URL(path, 'https://site.invalid'); return url.origin === 'https://site.invalid' ? url.pathname : null; } catch { return null; }
}
export const canonicalPath = (path: string) => path === '/' ? '/' : path.replace(/\/+$/, '');
export function publicOrigin(host: string): string {
  // Host is already resolved to a configured site. Do not trust forwarded host headers.
  const hostname = contentHostname(host);
  return `${hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1' ? 'http' : 'https'}://${host}`;
}
export function pageDetailWidgets(model: PublishedPageModel): Widget[] {
  const details: Widget[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const item = value as Record<string, unknown>;
    if (typeof item.type === 'string' && /(?:NewsDetailWidget|ObjectDetailWidget)$/.test(item.type)) details.push(item as unknown as Widget);
    Object.values(item).forEach(visit);
  };
  visit(model.slots);
  return details;
}
export function publishedDetail(model: PublishedPageModel): Record<string, unknown> {
  if (!Object.keys(model.context.pathVariables || {}).length) return {};
  const widget = pageDetailWidgets(model).find(widget => widget.data?.status === 'ready');
  return record(widget?.data?.item);
}
export async function websiteInfo(db: ReadDb, model: PublishedPageModel, host: string) {
  return db.withSnapshot(async reader => {
    const at = new Date();
    const [rootVersion, version] = await Promise.all([reader.version(model.context.siteId, at), reader.version(model.context.pageId, at)]);
    const root = websiteSettings(rootVersion?.page_data);
    const settings = websiteSettings(version?.page_data);
    const refs = Object.keys(settings.translations).length
      ? await reader.publishedPageReferences(Object.values(settings.translations).map(String), model.context.tenantId, at) : [];
    const visiblePages = refs.length && reader.sitePages ? new Set((await reader.sitePages(model.context.siteId, model.context.tenantId, at)).map(page => page.id)) : null;
    const translations = Object.entries(settings.translations).flatMap(([language, id]) => {
      const page = refs.find(page => page.id === String(id) && page.root_id === model.context.siteId && (!visiblePages || visiblePages.has(page.id)));
      const path = page && safePath(page.cached_path);
      return path ? [{ language, path: canonicalPath(path) }] : [];
    });
    const detail = publishedDetail(model);
    const detailImage = record(record(detail.data).featuredImage);
    const imageId = settings.shareImageId || (typeof detailImage.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(detailImage.id) ? detailImage.id : '') || root.shareImageId;
    const media = imageId ? await reader.publicMedia([imageId], [], model.context.tenantId) : { files: [] };
    const image = media.files[0]?.url || (!settings.shareImageId && !detailImage.id && typeof detailImage.url === 'string' ? detailImage.url : undefined);
    let shareImage: string | undefined;
    try { const url = new URL(image || '', publicOrigin(host)); if (image && ['https:', 'http:'].includes(url.protocol)) shareImage = url.href; } catch { /* Invalid image URLs are omitted. */ }
    return { ...settings, language: settings.language || root.language || 'en', translations, shareImage,
      analyticsEnabled: root.analyticsEnabled, analyticsRequireConsent: root.analyticsRequireConsent };
  });
}
export type WebsiteInfo = Awaited<ReturnType<typeof websiteInfo>>;
export function websiteMetadata(model: PublishedPageModel, info: WebsiteInfo, host: string, path: string): Metadata {
  const canonical = new URL(canonicalPath(path), publicOrigin(host)).href;
  const detail = publishedDetail(model);
  const title = typeof detail.title === 'string' && detail.title.trim() ? detail.title : model.title;
  const data = record(detail.data);
  const summary = typeof data.summary === 'string' ? data.summary : typeof data.description === 'string' ? data.description : '';
  const description = summary ? summary.replace(/<[^>]*>/g, '').slice(0, 300) : model.description;
  return { title, description,
    alternates: { canonical, languages: Object.fromEntries(info.translations.map(item => [item.language, new URL(item.path, canonical).href])) },
    robots: info.noIndex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { type: 'website', title, description, url: canonical,
      ...(info.shareImage ? { images: [{ url: info.shareImage }] } : {}) },
    twitter: { card: info.shareImage ? 'summary_large_image' : 'summary', title, description,
      ...(info.shareImage ? { images: [info.shareImage] } : {}) },
  };
}
export async function siteContext(db: ReadDb, host: string, includePages = true) {
  return db.withSnapshot(async reader => {
    const root = await reader.root(contentHostname(host));
    if (!root) return null;
    const at = new Date();
    const version = await reader.version(root.id, at);
    if (!version) return null;
    const pages = includePages ? await reader.sitePages?.(root.id, root.tenant_id, at) ?? [] : [];
    return { root, pages, settings: websiteSettings(version.page_data) };
  });
}
export type ArchiveKind = 'news' | 'publications' | 'events';
export const archiveTypes: Record<ArchiveKind, string[]> = {
  news: ['article', 'news'], publications: ['library_item', 'publication', 'report', 'library'], events: ['event'],
};
export function xmlEscape(value: string): string {
  return value.replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]!);
}

export function unresolvedDynamicDetail(model: PublishedPageModel): boolean {
  if (!model.remainingPath) return false;
  const variables = model.context.pathVariables || {};
  return !pageDetailWidgets(model).some(widget => {
    const config = widget.config;
    if (config.objectId || config.object_id || config.objectSlug || config.object_slug || widget.data?.status !== 'ready') return false;
    const variable = widget.type === 'easy_widgets.NewsDetailWidget'
      ? String(config.slugVariableName ?? config.slug_variable_name ?? 'news_slug')
      : ['news_slug', 'event_slug', 'library_slug', 'member_slug', 'date_slug', 'slug', 'category_slug'].find(key => variables[key]);
    return variable && variables[variable] && record(widget.data.item).slug === variables[variable];
  });
}
