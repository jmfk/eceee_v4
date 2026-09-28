export interface Page { id: number; tenant_id: number; parent_id: number | null; slug: string | null; title: string; hostnames: string[]; path_pattern: string }
export interface Version { id: number; page_id: number; meta_title: string; meta_description: string; code_layout: string; widgets: unknown }
export interface ReadDb { roots(): Promise<Page[]>; child(parentId: number, tenantId: number, slug: string): Promise<Page | null>; version(pageId: number, at: Date): Promise<Version | null> }
export interface Widget { id: string; type: string; config: Record<string, unknown> }
export interface PublishedPageModel { layout: string; slots: Record<string, Widget[]>; context: { mode: 'public'; preview: false; tenantId: string; siteId: number; pageId: number; versionId: number }; title: string; description: string; matchedPath: string; remainingPath: string }

export function normalizeHostname(input: string): string | null {
  const host = input.trim().toLowerCase();
  if (!host || host.length > 253 || /[\s/@?#%\\]/.test(host)) return null;
  if (host.startsWith('[')) {
    const match = /^\[([0-9a-f:.]+)\](?::\d{1,5})?$/.exec(host);
    return match ? `[${match[1]}]` : null;
  }
  const match = /^([a-z0-9.*-]+(?:\.[a-z0-9-]+)*)(?::\d{1,5})?$/.exec(host);
  return match ? match[1].replace(/\.$/, '') : null;
}
function widget(input: unknown, id: string): Widget | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const item = input as Record<string, unknown>;
  const type = item.type || item.widget_type;
  if (typeof type !== 'string') return null;
  const config = item.config && typeof item.config === 'object' && !Array.isArray(item.config) ? item.config as Record<string, unknown> : {};
  return { id: String(item.id ?? id), type, config };
}
export function normalizeWidgets(input: unknown): Record<string, Widget[]> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input).map(([slot, items]) => [slot, Array.isArray(items) ? items.map((item, i) => widget(item, `${slot}-${i}`)).filter((item): item is Widget => item !== null) : []]));
}
export async function buildPublishedPageModel(db: ReadDb, hostname: string, path: string, at = new Date()): Promise<PublishedPageModel | null> {
  const host = normalizeHostname(hostname);
  if (!host || !path.startsWith('/') || path.includes('?') || path.includes('#')) return null;
  const segments = path.split('/').filter(Boolean);
  if (segments.some(s => s === '.' || s === '..' || !/^[\p{L}\p{N}_-]+$/u.test(s)) || segments.length > 64) return null;
  const roots = (await db.roots()).filter(p => p.parent_id === null && p.hostnames.some(h => normalizeHostname(h) === host));
  if (roots.length !== 1) return null;
  const root = roots[0];
  let current = root, consumed = 0;
  for (const segment of segments) {
    const child = await db.child(current.id, root.tenant_id, segment);
    if (!child || child.parent_id !== current.id || child.tenant_id !== root.tenant_id) break;
    current = child;
    consumed++;
  }
  // Dynamic path-pattern resolution is outside this slice; never serve the prefix as a static page.
  if (consumed !== segments.length || current.path_pattern) return null;
  const version = await db.version(current.id, at);
  if (!version || version.page_id !== current.id) return null;
  const slots = normalizeWidgets(version.widgets);
  if (slots.landing_page && !slots.landingPage) slots.landingPage = slots.landing_page;
  return { layout: version.code_layout || 'main_layout', slots, context: { mode: 'public', preview: false, tenantId: String(root.tenant_id), siteId: root.id, pageId: current.id, versionId: version.id }, title: version.meta_title || current.title, description: version.meta_description || '', matchedPath: '/' + segments.slice(0, consumed).join('/'), remainingPath: '' };
}
