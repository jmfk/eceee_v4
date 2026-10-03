import { compileThemeCss, fontImports, widgetVariantClasses } from './theme';

export type DbId = string;

export interface Page {
  id: DbId;
  tenant_id: DbId;
  parent_id: DbId | null;
  slug: string | null;
  title: string;
  hostnames: string[];
  path_pattern: string;
  enable_css_injection: boolean;
  page_css_variables: Record<string, unknown>;
  page_custom_css: string;
}

export interface Version {
  id: DbId;
  page_id: DbId;
  meta_title: string;
  meta_description: string;
  code_layout: string;
  widgets: unknown;
  theme_id: DbId | null;
  enable_css_injection: boolean;
  page_css_variables: Record<string, unknown>;
  page_custom_css: string;
}

export interface Theme {
  id: DbId;
  tenant_id: DbId;
  name: string;
  fonts: Record<string, unknown>;
  colors: Record<string, unknown>;
  css_variables: Record<string, unknown>;
  component_styles: Record<string, Record<string, unknown>>;
  image_styles: Record<string, Record<string, unknown>>;
  gallery_styles: Record<string, Record<string, unknown>>;
  carousel_styles: Record<string, Record<string, unknown>>;
  breakpoints: Record<string, unknown>;
  custom_css: string;
  design_groups: Record<string, unknown>;
  html_elements: Record<string, unknown>;
  sync_version: number;
  updated_at: string;
}

export interface PublishedPageReference {
  id: DbId;
  cached_path: string;
}

export interface PublishedNavigationPage {
  id: DbId;
  parent_id: DbId;
  title: string;
  label: string;
  slug: string;
  cached_path: string;
  sort_order: number;
}

export interface PublishedObject {
  id: DbId;
  title: string;
  slug: string;
  objectType: { id: DbId; name: string; label: string; pluralLabel: string };
  data: Record<string, unknown>;
  widgets: Record<string, unknown>;
  metadata: Record<string, unknown>;
  publishDate: string;
  isFeatured: boolean;
  createdAt?: string;
  updatedAt?: string;
  level?: number;
  parent?: PublishedObjectLink;
  ancestors?: PublishedObjectLink[];
  children?: PublishedObjectLink[];
}

export interface PublishedObjectLink {
  id: DbId;
  title: string;
  slug: string;
  objectType: { id: DbId; name: string; label: string; pluralLabel: string };
  publishDate?: string;
  path?: string;
}

export interface PublishedObjectQuery {
  objectIds?: DbId[];
  objectTypeIds?: DbId[];
  objectTypeNames?: string[];
  slug?: string;
  limit: number;
  sortOrder: string;
  featuredFirst?: boolean;
  includeHierarchy?: boolean;
}

export interface PublicMediaItem {
  id: DbId;
  url: string;
  type: string;
  altText: string;
  caption: string;
  annotation: string;
  title: string;
  width: number | null;
  height: number | null;
  thumbnailUrl: string;
}

export interface PageReader {
  root(hostname: string): Promise<Page | null>;
  child(parentId: DbId, tenantId: DbId, slug: string): Promise<Page | null>;
  version(pageId: DbId, at: Date): Promise<Version | null>;
  theme(themeId: DbId, tenantId: DbId): Promise<Theme | null>;
  defaultTheme(tenantId: DbId): Promise<Theme | null>;
  publishedPageReferences(pageIds: DbId[], tenantId: DbId, rootId: DbId, at: Date): Promise<PublishedPageReference[]>;
  publishedNavigationPages(parentIds: DbId[], tenantId: DbId, rootId: DbId, at: Date): Promise<PublishedNavigationPage[]>;
  publicMedia(mediaIds: DbId[], collectionIds: DbId[], tenantId: DbId): Promise<{
    files: PublicMediaItem[];
    collections: Record<DbId, PublicMediaItem[]>;
  }>;
  publishedObjects(query: PublishedObjectQuery, tenantId: DbId, at: Date): Promise<PublishedObject[]>;
}

export interface ReadDb {
  withSnapshot<T>(read: (db: PageReader) => Promise<T>): Promise<T>;
}

export interface Widget {
  id: string;
  type: string;
  config: Record<string, unknown>;
  data?: { status: 'ready' | 'loading' | 'empty' | 'error'; [key: string]: unknown };
  inheritedFrom?: { id: DbId; title: string; depth: number } | null;
}

export interface PublishedPageModel {
  layout: string;
  slots: Record<string, Widget[]>;
  context: {
    mode: 'public';
    preview: false;
    tenantId: DbId;
    siteId: DbId;
    siteHostnames: string[];
    pageId: DbId;
    versionId: DbId;
    pathVariables: Record<string, string>;
    simulatedPath: string;
    componentStyles: Record<string, Record<string, unknown>>;
    publicForms: {
      endpointBase: string;
      pagePath: string;
      result?: { widgetId: string; status: 'success' | 'error' };
    };
  };
  fontCss: string;
  themeCss: string;
  title: string;
  description: string;
  matchedPath: string;
  remainingPath: string;
}

type RawWidget = Record<string, unknown>;
const LAYOUT_SLOTS: Record<string, string[]> = {
  main_layout: ['header', 'navbar', 'hero', 'main', 'sidebar', 'footer'],
  landing_page: ['header', 'navbar', 'hero', 'landing_page', 'footer'],
};

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

function object(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
}

function value(input: RawWidget, ...names: string[]): unknown {
  return names.map(name => input[name]).find(candidate => candidate !== undefined && candidate !== null);
}

function dateVisible(input: RawWidget, at: Date): boolean {
  if (value(input, 'is_visible', 'isVisible') === false || value(input, 'is_published', 'isPublished') === false) return false;
  const effective = value(input, 'publish_effective_date', 'publishEffectiveDate');
  const expiry = value(input, 'publish_expire_date', 'publishExpireDate');
  if (effective && new Date(String(effective)) > at) return false;
  if (expiry && new Date(String(expiry)) < at) return false;
  return true;
}

function inheritanceDepthAllowed(input: RawWidget, depth: number): boolean {
  if (depth === 0) return true;
  if (value(input, 'inherit_from_parent', 'inheritFromParent') === false) return false;
  const configured = Number(value(input, 'inheritance_level', 'inheritanceLevel') ?? 0);
  return configured === -1 || configured >= depth;
}

function rawSlot(version: Version, slot: string, at: Date, depth: number): RawWidget[] {
  const widgets = object(version.widgets)[slot];
  return Array.isArray(widgets)
    ? widgets.filter((item): item is RawWidget => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
      .filter(item => dateVisible(item, at) && inheritanceDepthAllowed(item, depth))
    : [];
}

function normalizeNestedWidgets(input: unknown, at: Date, idPrefix: string): Widget[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((candidate, index) => {
    const raw = object(candidate);
    if (!dateVisible(raw, at)) return [];
    const normalized = normalizeWidget(raw, `${idPrefix}-${index}`, null, 0, at);
    return normalized ? [normalized] : [];
  });
}

function normalizeNestedItem(input: unknown, at: Date, idPrefix: string): Record<string, unknown> {
  const item = object(input);
  const widgets = object(item.widgets);
  if (!Object.keys(widgets).length) return item;
  return {
    ...item,
    widgets: Object.fromEntries(Object.entries(widgets).map(([slot, nested]) => [
      slot,
      normalizeNestedWidgets(nested, at, `${idPrefix}-${slot}`),
    ])),
  };
}

function normalizeWidgetConfig(type: string, input: unknown, at: Date, idPrefix: string): Record<string, unknown> {
  const config = object(input);
  const slots = object(config.slots);
  const configuredItem = object(config.item);
  const normalized = { ...config };
  if (Object.keys(slots).length) {
    normalized.slots = Object.fromEntries(Object.entries(slots).map(([slot, widgets]) => [
      slot,
      normalizeNestedWidgets(widgets, at, `${idPrefix}-${slot}`),
    ]));
  }
  if (type === 'easy_widgets.SectionWidget' && Array.isArray(config.widgets)) {
    normalized.widgets = normalizeNestedWidgets(config.widgets, at, `${idPrefix}-widgets`);
  }
  if (Object.keys(object(configuredItem.widgets)).length) {
    normalized.item = normalizeNestedItem(config.item, at, `${idPrefix}-item`);
  }
  return normalized;
}

function normalizeWidget(input: RawWidget, id: string, inheritedFrom: Page | null, depth: number, at: Date): Widget | null {
  const type = input.type || input.widget_type;
  if (typeof type !== 'string') return null;
  const rawData = object(input.data || input.resolvedData);
  const normalizedData = rawData.item
    ? { ...rawData, item: normalizeNestedItem(rawData.item, at, `${String(input.id ?? id)}-data-item`) }
    : rawData;
  const status = ['ready', 'loading', 'empty', 'error'].includes(String(rawData.status))
    ? rawData.status as 'ready' | 'loading' | 'empty' | 'error'
    : 'ready';
  return {
    id: String(input.id ?? id),
    type,
    config: normalizeWidgetConfig(type, input.config, at, String(input.id ?? id)),
    ...(Object.keys(normalizedData).length ? { data: { ...normalizedData, status } } : {}),
    ...(inheritedFrom ? { inheritedFrom: { id: inheritedFrom.id, title: inheritedFrom.title, depth } } : {}),
  };
}

export function normalizeWidgets(input: unknown, at = new Date()): Record<string, Widget[]> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input).map(([slot, items]) => [
    slot,
    Array.isArray(items)
      ? items.map((item, index) => normalizeWidget(object(item), `${slot}-${index}`, null, 0, at)).filter((item): item is Widget => item !== null)
      : [],
  ]));
}

function mergeSlot(
  slot: string,
  chain: Array<{ page: Page; version: Version; depth: number }>,
  at: Date,
): Widget[] {
  const candidates: Array<{ item: RawWidget; page: Page | null; depth: number; behavior: string }> = [];
  for (let index = chain.length - 1; index >= 0; index--) {
    const owner = chain[index];
    const depth = owner.depth;
    for (const item of rawSlot(owner.version, slot, at, depth)) {
      const explicitBehavior = value(item, 'inheritanceBehavior', 'inheritance_behavior');
      const replacesParent = value(item, 'inheritFromParent', 'inherit_from_parent') === false
        || value(item, 'overrideParent', 'override_parent') === true;
      const behavior = String(explicitBehavior ?? (replacesParent ? 'override_parent' : 'insert_after_parent'));
      candidates.push({ item, page: depth ? owner.page : null, depth, behavior });
    }
  }
  const closestOverride = candidates.filter(candidate => candidate.behavior === 'override_parent')
    .reduce<number | null>((closest, candidate) => closest === null ? candidate.depth : Math.min(closest, candidate.depth), null);
  const visible = closestOverride === null ? candidates : candidates.filter(candidate => candidate.depth <= closestOverride);
  const before = visible.filter(candidate => candidate.behavior === 'insert_before_parent').sort((left, right) => left.depth - right.depth);
  const override = visible.filter(candidate => candidate.behavior === 'override_parent').sort((left, right) => left.depth - right.depth);
  const after = visible.filter(candidate => candidate.behavior === 'insert_after_parent').sort((left, right) => right.depth - left.depth);
  const selected = [...before, ...override, ...after];
  return selected.map(({ item, page, depth }, index) => normalizeWidget(item, `${slot}-${index}`, page, depth, at)).filter((item): item is Widget => item !== null);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_POSTGRES_BIGINT = 9_223_372_036_854_775_807n;

function pageReferenceId(input: unknown): DbId | null {
  const candidate = String(input ?? '').trim();
  if (!/^\d+$/.test(candidate) || candidate.length > 19) return null;
  const numeric = BigInt(candidate);
  return numeric > 0n && numeric <= MAX_POSTGRES_BIGINT ? numeric.toString() : null;
}

function addPageReference(ids: Set<DbId>, input: unknown): void {
  const id = pageReferenceId(input);
  if (id) ids.add(id);
}

function addUuidReference(ids: Set<DbId>, input: unknown): void {
  const id = String(input ?? '').trim();
  if (UUID_PATTERN.test(id)) ids.add(id.toLowerCase());
}

function collectReferences(value: unknown, pageIds: Set<DbId>, mediaIds: Set<DbId>, collectionIds: Set<DbId>): void {
  if (typeof value === 'string') {
    const decoded = value.replaceAll('&quot;', '"').replaceAll('&#34;', '"');
    for (const match of decoded.matchAll(/(?:data-page-id|data-page_id)\s*=\s*["']?(\d+)|["']?(?:pageId|page_id)["']?\s*:\s*["']?(\d+)/gi)) {
      addPageReference(pageIds, match[1] || match[2]);
    }
    for (const match of decoded.matchAll(/data-media-id\s*=\s*["']([0-9a-f-]{36})["']/gi)) {
      addUuidReference(mediaIds, match[1]);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectReferences(item, pageIds, mediaIds, collectionIds));
    return;
  }
  if (!value || typeof value !== 'object') return;
  const item = value as Record<string, unknown>;
  const pageId = item.pageId ?? item.page_id;
  if (pageId !== undefined && pageId !== null) addPageReference(pageIds, pageId);
  const id = item.id === undefined || item.id === null ? '' : String(item.id);
  const collectionId = item.collectionId ?? item.collection_id;
  if (collectionId) addUuidReference(collectionIds, collectionId);
  if (id && (item.type === 'collection' || item.fileCount !== undefined || item.file_count !== undefined || item.sampleImages !== undefined || item.sample_images !== undefined)) {
    addUuidReference(collectionIds, id);
  } else if (UUID_PATTERN.test(id) && (item.type === 'image' || item.type === 'video' || item.fileUrl !== undefined || item.file_url !== undefined || item.originalFilename !== undefined)) {
    addUuidReference(mediaIds, id);
  }
  Object.values(item).forEach(child => collectReferences(child, pageIds, mediaIds, collectionIds));
}

function htmlAttribute(attributes: string, name: string): string {
  const match = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(attributes);
  return match?.[2] ?? '';
}

function escapeHtmlAttribute(value: unknown): string {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function replaceHtmlMedia(html: string, media: Map<DbId, PublicMediaItem>): string {
  return html.replace(/<(?:div|figure)\b([^>]*\bdata-media-id\s*=\s*(["'])([0-9a-f-]{36})\2[^>]*)>([\s\S]*?)<\/(?:div|figure)>/gi, (tag, attributes: string, _quote: string, id: string, inner: string) => {
    const item = media.get(id);
    if (item && item.type !== 'image') return '';
    const savedImage = /<img\b([^>]*)>/i.exec(inner)?.[1] ?? '';
    const source = item?.url || htmlAttribute(savedImage, 'src');
    if (!source) return tag;
    const width = htmlAttribute(attributes, 'data-width') || 'full';
    const align = htmlAttribute(attributes, 'data-align') || 'left';
    const title = htmlAttribute(attributes, 'data-title') || item?.altText || item?.title || htmlAttribute(savedImage, 'alt');
    const captionText = item?.caption || htmlAttribute(attributes, 'data-caption');
    const caption = captionText ? `<figcaption>${escapeHtmlAttribute(captionText)}</figcaption>` : '';
    const dimensions = item?.width && item?.height
      ? ` width="${escapeHtmlAttribute(item.width)}" height="${escapeHtmlAttribute(item.height)}"`
      : '';
    return `<figure class="media-insert img-width-${escapeHtmlAttribute(width)} media-align-${escapeHtmlAttribute(align)}"><img src="${escapeHtmlAttribute(source)}" alt="${escapeHtmlAttribute(title)}" class="img-width-${escapeHtmlAttribute(width)}"${dimensions} loading="lazy">${caption}</figure>`;
  });
}

function pageHref(path: string, anchor: unknown): string {
  const fragment = typeof anchor === 'string' ? anchor.replace(/^#/, '') : '';
  return fragment ? `${path}#${fragment}` : path;
}

function replaceHtmlPageLinks(html: string, paths: Map<DbId, string>): string {
  const structured = html.replace(/\bhref=(['"])(.*?)\1/gi, (attribute, quote: string, rawValue: string) => {
    const decoded = rawValue.replaceAll('&quot;', '"').replaceAll('&#34;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&');
    if (!decoded.trim().startsWith('{')) return attribute;
    try {
      const link = JSON.parse(decoded) as Record<string, unknown>;
      if (link.type === 'internal') {
        const path = paths.get(String(link.pageId ?? link.page_id ?? ''));
        return path ? `href=${quote}${pageHref(path, link.anchor)}${quote}` : 'aria-disabled="true"';
      }
      if (link.type === 'external' || link.type === 'media') return link.url ? `href=${quote}${String(link.url)}${quote}` : 'aria-disabled="true"';
      if (link.type === 'email') return link.address ? `href=${quote}mailto:${String(link.address)}${quote}` : 'aria-disabled="true"';
      if (link.type === 'phone') return link.number ? `href=${quote}tel:${String(link.number).replace(/[^\d+]/g, '')}${quote}` : 'aria-disabled="true"';
      if (link.type === 'anchor') return link.anchor ? `href=${quote}#${String(link.anchor).replace(/^#/, '')}${quote}` : 'aria-disabled="true"';
    } catch { return 'aria-disabled="true"'; }
    return 'aria-disabled="true"';
  });
  return structured.replace(/<a\b([^>]*)>/gi, (tag, attributes: string) => {
    const match = /(?:data-page-id|data-page_id|page-id|pageId)\s*=\s*["']?(\d+)["']?/i.exec(attributes);
    if (!match) return tag;
    const path = paths.get(match[1]);
    const withoutHref = attributes.replace(/\s+href\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '');
    return path
      ? `<a${withoutHref} href="${path}">`
      : `<a${withoutHref} aria-disabled="true">`;
  });
}

function enrichValue(value: unknown, pagePaths: Map<DbId, string>, media: Map<DbId, PublicMediaItem>): unknown {
  if (typeof value === 'string') {
    const links = value.includes('<a') ? replaceHtmlPageLinks(value, pagePaths) : value;
    return links.includes('data-media-id') ? replaceHtmlMedia(links, media) : links;
  }
  if (Array.isArray(value)) return value.map(item => enrichValue(item, pagePaths, media));
  if (!value || typeof value !== 'object') return value;
  const input = value as Record<string, unknown>;
  const result = Object.fromEntries(Object.entries(input).map(([key, child]) => [key, enrichValue(child, pagePaths, media)]));
  const pageId = input.pageId ?? input.page_id;
  if (pageId !== undefined && pageId !== null) {
    const resolved = pagePaths.get(String(pageId));
    if (resolved) {
      result.resolvedUrl = pageHref(resolved, input.anchor);
      result.url = result.resolvedUrl;
      result.isPublished = true;
    } else {
      delete result.resolvedUrl;
      delete result.resolved_url;
      delete result.url;
      delete result.path;
      result.isActive = false;
      result.isPublished = false;
    }
  }
  const id = input.id === undefined || input.id === null ? '' : String(input.id);
  if (id && media.has(id.toLowerCase()) && !result.url && !result.fileUrl && !result.file_url) return { ...result, ...media.get(id.toLowerCase()) };
  return result;
}

function prepareWidgets(
  slots: Record<string, Widget[]>,
  pagePaths: Map<DbId, string>,
  files: PublicMediaItem[],
  collections: Record<DbId, PublicMediaItem[]>,
  theme: Theme | null,
  pages: Page[],
  navigationPages: PublishedNavigationPage[],
): Record<string, Widget[]> {
  const media = new Map(files.map(item => [String(item.id), item]));
  const current = pages.at(-1)!;
  const parent = pages.at(-2);
  const childrenByParent = new Map<DbId, PublishedNavigationPage[]>();
  for (const page of navigationPages) {
    const parentId = String(page.parent_id);
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(page);
    childrenByParent.set(parentId, siblings);
  }
  const navigationItem = (page: PublishedNavigationPage) => ({
    id: page.id,
    label: page.label,
    title: page.title,
    path: page.cached_path,
    url: page.cached_path,
    resolvedUrl: page.cached_path,
    isActive: true,
    isPublished: true,
    type: 'internal',
    order: page.sort_order,
  });
  const currentChildren = (childrenByParent.get(String(current.id)) ?? []).map(navigationItem);
  const parentChildren = parent ? (childrenByParent.get(String(parent.id)) ?? []).map(navigationItem) : [];
  const parentItem = parent ? {
    id: parent.id,
    label: parent.title,
    title: parent.title,
    path: parent.id === pages[0].id ? '/' : `/${pages.slice(1, -1).map(page => page.slug).filter(Boolean).join('/')}/`,
  } : null;
  const prepare = (widget: Widget): Widget => {
    const enriched = enrichValue(widget.config, pagePaths, media) as Record<string, unknown>;
    const prepareValue = (candidate: unknown): unknown => {
      if (Array.isArray(candidate)) return candidate.map(prepareValue);
      if (!candidate || typeof candidate !== 'object') return candidate;
      const record = candidate as Record<string, unknown>;
      if (typeof record.type === 'string' && record.config && typeof record.config === 'object') return prepare(record as unknown as Widget);
      return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, prepareValue(child)]));
    };
    const config = prepareValue(enriched) as Record<string, unknown>;
    config.variantClasses = widgetVariantClasses(widget.type, config);
    if (widget.type === 'easy_widgets.NavigationWidget') {
      config.publisherNavigation = {
        isInherited: pages.length > 1,
        depth: pages.length - 1,
        currentChildren,
        parentChildren,
        parentPage: parentItem,
      };
      if (config.includeSubpages === true || config.include_subpages === true) {
        config.dynamicItems = currentChildren;
      }
    }
    if (widget.type === 'easy_widgets.ImageWidget') {
      const image = object(config.image);
      const collectionId = image.type === 'collection' ? image.id : (image.collectionId ?? image.collection_id ?? config.collectionId ?? config.collection_id);
      if (collectionId) {
        let items = collections[String(collectionId).toLowerCase()] ?? [];
        const collectionConfig = object(config.collectionConfig ?? config.collection_config);
        const limit = Number(collectionConfig.maxItems ?? collectionConfig.max_items ?? 0);
        if (limit > 0) items = items.slice(0, limit);
        config.mediaItems = items;
      } else if (Object.keys(image).length) {
        const item = media.get(String(image.id ?? '').toLowerCase()) ?? image;
        config.mediaItems = [item];
      }
      const styleName = String(config.imageStyle ?? config.image_style ?? '');
      const style = theme?.image_styles[styleName] ?? theme?.gallery_styles[styleName] ?? theme?.carousel_styles[styleName];
      if (!config.displayType && !config.display_type && style?.styleType) config.displayType = style.styleType;
      if (config.showCaptions === undefined && config.show_captions === undefined && style?.defaultShowCaptions !== undefined) config.showCaptions = style.defaultShowCaptions;
    }
    const data = widget.data
      ? prepareValue(enrichValue(widget.data, pagePaths, media)) as Widget['data']
      : undefined;
    return { ...widget, config, ...(data ? { data } : {}) };
  };
  return Object.fromEntries(Object.entries(slots).map(([slot, widgets]) => [slot, widgets.map(prepare)]));
}

const PATH_PATTERNS: Record<string, { expression: RegExp; variables: string[] }> = {
  news_slug: { expression: /^([\p{L}\p{N}_-]+)\/$/u, variables: ['news_slug'] },
  event_slug: { expression: /^([\p{L}\p{N}_-]+)\/$/u, variables: ['event_slug'] },
  library_slug: { expression: /^([\p{L}\p{N}_-]+)\/$/u, variables: ['library_slug'] },
  member_slug: { expression: /^([\p{L}\p{N}_-]+)\/$/u, variables: ['member_slug'] },
  date_slug: { expression: /^(\d{4})\/(\d{2})\/([\p{L}\p{N}_-]+)\/$/u, variables: ['year', 'month', 'date_slug'] },
  year_slug: { expression: /^(\d{4})\/([\p{L}\p{N}_-]+)\/$/u, variables: ['year', 'slug'] },
  numeric_id: { expression: /^(\d+)\/$/, variables: ['id'] },
  category_slug: { expression: /^([\p{L}\p{N}_-]+)\/([\p{L}\p{N}_-]+)\/$/u, variables: ['category', 'category_slug'] },
};

function matchPathPattern(key: string, remainingPath: string): Record<string, string> | null {
  const pattern = PATH_PATTERNS[key];
  const match = pattern?.expression.exec(remainingPath);
  if (!pattern || !match) return null;
  return Object.fromEntries(pattern.variables.map((name, index) => [name, match[index + 1]]));
}

function stringList(input: unknown): string[] {
  return Array.isArray(input)
    ? input.map(value => String(value)).filter(Boolean)
    : [];
}

function positiveLimit(input: unknown, fallback: number): number {
  const limit = Number(input);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, 50) : fallback;
}

function topNewsLimit(layout: unknown): number {
  const limits: Record<string, number> = {
    '1x3': 3,
    '1x2': 2,
    '2x3_2': 5,
    '2x1': 2,
    '2x2': 4,
  };
  return limits[String(layout ?? '1x3')] ?? 3;
}

function objectPath(basePath: string, slug: string): string {
  return `${basePath === '/' ? '' : basePath}/${encodeURIComponent(slug)}/`.replace(/^$/, '/');
}

async function resolvePublishedData(
  slots: Record<string, Widget[]>,
  reader: PageReader,
  tenantId: DbId,
  at: Date,
  pagePath: string,
  pathVariables: Record<string, string>,
): Promise<Record<string, Widget[]>> {
  const resolve = async (widget: Widget, objectStack = new Set<string>()): Promise<Widget> => {
    const resolveNested = async (candidate: unknown, activeObjectStack = objectStack): Promise<unknown> => {
      if (Array.isArray(candidate)) {
        const values: unknown[] = [];
        for (const value of candidate) values.push(await resolveNested(value, activeObjectStack));
        return values;
      }
      if (!candidate || typeof candidate !== 'object') return candidate;
      const record = candidate as Record<string, unknown>;
      if (typeof record.type === 'string' && record.config && typeof record.config === 'object') {
        return resolve(record as unknown as Widget, activeObjectStack);
      }
      const entries: Array<[string, unknown]> = [];
      for (const [key, value] of Object.entries(record)) entries.push([key, await resolveNested(value, activeObjectStack)]);
      return Object.fromEntries(entries);
    };
    const config = await resolveNested(widget.config) as Record<string, unknown>;
    const prepared = config === widget.config ? widget : { ...widget, config };
    if (prepared.data?.item || (Array.isArray(prepared.data?.items) && prepared.data.items.length)) return prepared;
    let items: PublishedObject[] | null = null;
    let item: PublishedObject | undefined;
    if (widget.type === 'easy_widgets.NewsListWidget') {
      items = await reader.publishedObjects({
        objectTypeIds: stringList(config.objectTypes ?? config.object_types),
        limit: positiveLimit(config.limit, 10),
        sortOrder: String(config.sortOrder ?? config.sort_order ?? '-publish_date'),
        featuredFirst: true,
      }, tenantId, at);
    } else if (widget.type === 'object_storage.ObjectListWidget') {
      const objectType = String(config.objectType ?? config.object_type ?? '');
      if (objectType) {
        const showHierarchy = (config.showHierarchy ?? config.show_hierarchy) === true;
        items = await reader.publishedObjects({
          objectTypeNames: [objectType],
          limit: positiveLimit(config.limit, 5),
          sortOrder: String(config.orderBy ?? config.order_by ?? '-created_at'),
          includeHierarchy: showHierarchy,
        }, tenantId, at);
      } else {
        items = [];
      }
    } else if (widget.type === 'easy_widgets.TopNewsPlugWidget' || widget.type === 'easy_widgets.SidebarTopNewsWidget') {
      items = await reader.publishedObjects({
        objectTypeNames: stringList(config.objectTypes ?? config.object_types),
        limit: widget.type === 'easy_widgets.TopNewsPlugWidget'
          ? topNewsLimit(config.layout)
          : positiveLimit(config.limit ?? config.maxItems ?? config.max_items, 5),
        sortOrder: String(config.sortOrder ?? config.sort_order ?? '-publish_date'),
        featuredFirst: true,
      }, tenantId, at);
    } else if (widget.type === 'easy_widgets.NewsDetailWidget') {
      const variable = String(config.slugVariableName ?? config.slug_variable_name ?? 'news_slug');
      const slug = pathVariables[variable];
      if (slug) {
        [item] = await reader.publishedObjects({
          objectTypeIds: stringList(config.objectTypes ?? config.object_types),
          slug,
          limit: 1,
          sortOrder: '-publish_date',
        }, tenantId, at);
      }
    } else if (widget.type === 'object_storage.ObjectDetailWidget') {
      const objectId = String(config.objectId ?? config.object_id ?? '');
      const objectType = String(config.objectType ?? config.object_type ?? '');
      const slug = String(config.objectSlug ?? config.object_slug ?? Object.values(pathVariables)[0] ?? '');
      if (/^\d+$/.test(objectId)) {
        [item] = await reader.publishedObjects({
          objectIds: [objectId],
          limit: 1,
          sortOrder: '-publish_date',
          includeHierarchy: true,
        }, tenantId, at);
      } else if (objectType && slug) {
        [item] = await reader.publishedObjects({
          objectTypeNames: [objectType],
          slug,
          limit: 1,
          sortOrder: '-publish_date',
          includeHierarchy: true,
        }, tenantId, at);
      }
    }
    if (items) {
      return { ...prepared, data: { status: items.length ? 'ready' : 'empty', items: items.map(value => ({ ...value, path: objectPath(pagePath, value.slug) })) } };
    }
    if (widget.type === 'easy_widgets.NewsDetailWidget' || widget.type === 'object_storage.ObjectDetailWidget') {
      if (item) {
        const withPath = (related: PublishedObjectLink) => ({ ...related, path: objectPath(pagePath, related.slug) });
        const objectId = String(item.id);
        const isCycle = objectStack.has(objectId);
        const nestedObjectStack = new Set(objectStack);
        nestedObjectStack.add(objectId);
        item = {
          ...item,
          widgets: isCycle ? {} : await resolveNested(item.widgets, nestedObjectStack) as Record<string, unknown>,
          ancestors: item.ancestors?.map(withPath),
          children: item.children?.map(withPath),
        };
      }
      return { ...prepared, data: item
        ? { status: 'ready', item: { ...item, path: objectPath(pagePath, item.slug) } }
        : { status: 'empty' } };
    }
    return prepared;
  };
  const resolved: Record<string, Widget[]> = {};
  for (const [slot, widgets] of Object.entries(slots)) {
    resolved[slot] = [];
    for (const widget of widgets) resolved[slot].push(await resolve(widget));
  }
  return resolved;
}

export async function buildPublishedPageModel(db: ReadDb, hostname: string, path: string, at = new Date()): Promise<PublishedPageModel | null> {
  const host = normalizeHostname(hostname);
  if (!host || !path.startsWith('/') || path.includes('?') || path.includes('#')) return null;
  const segments = path.split('/').filter(Boolean);
  if (segments.some(segment => segment === '.' || segment === '..' || !/^[\p{L}\p{N}_-]+$/u.test(segment)) || segments.length > 64) return null;

  return db.withSnapshot(async reader => {
    const root = await reader.root(host);
    if (!root || root.parent_id !== null) return null;
    const pages = [root];
    let current = root;
    for (const segment of segments) {
      const child = await reader.child(current.id, root.tenant_id, segment);
      if (!child || child.parent_id !== current.id || child.tenant_id !== root.tenant_id) break;
      pages.push(child);
      current = child;
    }
    const consumedSegments = pages.length - 1;
    const remainingSegments = segments.slice(consumedSegments);
    const remainingPath = remainingSegments.length ? `${remainingSegments.join('/')}/` : '';
    const pathVariables = remainingPath ? matchPathPattern(current.path_pattern, remainingPath) : {};
    if (remainingPath && !pathVariables) return null;

    // PageReader methods share one PostgreSQL client inside a repeatable-read
    // transaction. Keep reads sequential: node-postgres does not support
    // concurrent queries on a single client and is removing its legacy queueing.
    const versions: Array<Version | null> = [];
    for (const page of pages) versions.push(await reader.version(page.id, at));
    const currentVersion = versions.at(-1);
    if (!currentVersion || currentVersion.page_id !== current.id) return null;
    const chain = pages.flatMap((page, index) => versions[index]
      ? [{ page, version: versions[index]!, depth: pages.length - 1 - index }]
      : []);
    const layout = [...chain].reverse().find(item => item.version.code_layout)?.version.code_layout || 'main_layout';
    const slotNames = new Set([...(LAYOUT_SLOTS[layout] ?? []), ...chain.flatMap(item => Object.keys(object(item.version.widgets)))]);
    let slots = Object.fromEntries([...slotNames].map(slot => [
      slot,
      mergeSlot(slot, chain, at),
    ]));
    if (slots.landing_page && !slots.landingPage) slots.landingPage = slots.landing_page;

    const explicitThemeId = [...chain].reverse().find(item => item.version.theme_id)?.version.theme_id;
    const theme = explicitThemeId
      ? await reader.theme(explicitThemeId, root.tenant_id)
      : await reader.defaultTheme(root.tenant_id);

    const matchedPath = '/' + segments.slice(0, consumedSegments).join('/');
    slots = await resolvePublishedData(slots, reader, root.tenant_id, at, matchedPath || '/', pathVariables || {});

    const pageIds = new Set<DbId>();
    const mediaIds = new Set<DbId>();
    const collectionIds = new Set<DbId>();
    collectReferences(slots, pageIds, mediaIds, collectionIds);
    const references = await reader.publishedPageReferences([...pageIds], root.tenant_id, root.id, at);
    const navigationPages = await reader.publishedNavigationPages(pages.map(page => page.id), root.tenant_id, root.id, at);
    const publicMedia = await reader.publicMedia([...mediaIds], [...collectionIds], root.tenant_id);
    const pagePaths = new Map(references.map(reference => [String(reference.id), reference.cached_path]));
    slots = prepareWidgets(slots, pagePaths, publicMedia.files, publicMedia.collections, theme, pages, navigationPages);

    return {
      layout,
      slots,
      context: {
        mode: 'public',
        preview: false,
        tenantId: root.tenant_id,
        siteId: root.id,
        siteHostnames: root.hostnames,
        pageId: current.id,
        versionId: currentVersion.id,
        pathVariables: pathVariables || {},
        simulatedPath: '/' + segments.join('/') + (segments.length ? '/' : ''),
        componentStyles: theme?.component_styles ?? {},
        publicForms: {
          endpointBase: `/api/forms/${encodeURIComponent(current.id)}`,
          pagePath: '/' + segments.join('/'),
        },
      },
      fontCss: theme ? fontImports(theme.fonts) : '',
      themeCss: compileThemeCss(theme, current, currentVersion, slots),
      title: currentVersion.meta_title || current.title,
      description: currentVersion.meta_description || '',
      matchedPath,
      remainingPath,
    };
  });
}
