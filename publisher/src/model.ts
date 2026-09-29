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
}

export interface PageReader {
  root(hostname: string): Promise<Page | null>;
  child(parentId: DbId, tenantId: DbId, slug: string): Promise<Page | null>;
  version(pageId: DbId, at: Date): Promise<Version | null>;
  theme(themeId: DbId, tenantId: DbId): Promise<Theme | null>;
  defaultTheme(tenantId: DbId): Promise<Theme | null>;
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
    componentStyles: Record<string, Record<string, unknown>>;
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

function cssRecord(input: Record<string, unknown>): string {
  return Object.entries(input)
    .filter(([name, candidate]) => /^[a-zA-Z0-9_-]+$/.test(name) && ['string', 'number'].includes(typeof candidate))
    .map(([name, candidate]) => `  --${name.replace(/^--/, '')}: ${String(candidate)};`)
    .join('\n');
}

function fontImports(fonts: Record<string, unknown>): string {
  const configured = fonts.google_fonts ?? fonts.googleFonts;
  if (!Array.isArray(configured)) return '';
  return configured.flatMap(font => {
    const definition = object(font);
    const family = String(definition.family ?? '').trim().replace(/\s+/g, '+');
    if (!family) return [];
    const variants = Array.isArray(definition.variants)
      ? definition.variants.map(String).filter(variant => /^\d+$/.test(variant))
      : [];
    const display = /^(auto|block|fallback|optional|swap)$/.test(String(definition.display))
      ? String(definition.display)
      : 'swap';
    return [`@import url('https://fonts.googleapis.com/css2?family=${family}${variants.length ? `:wght@${variants.join(';')}` : ''}&display=${display}');`];
  }).join('\n');
}

function styleCss(styles: Record<string, Record<string, unknown>>, configuredBreakpoints: Record<string, unknown>): string {
  const breakpoints: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280 };
  for (const [name, candidate] of Object.entries(configuredBreakpoints)) {
    const pixels = Number(candidate);
    if (name in breakpoints && Number.isFinite(pixels) && pixels > 0) breakpoints[name] = pixels;
  }
  return Object.values(styles).flatMap(style => {
    const css = style.css;
    if (typeof css === 'string') return css;
    const responsive = object(css);
    return Object.entries(responsive).flatMap(([key, block]) => {
      if (typeof block !== 'string') return [];
      if (key === 'default') return [block];
      return breakpoints[key] ? [`@media (min-width: ${breakpoints[key]}px) {\n${block}\n}`] : [];
    });
  }).join('\n');
}

function effectivePageCss(page: Page, version: Version): { variables: Record<string, unknown>; customCss: string } {
  // Match WebPage.get_effective_css_data(): either level can disable page CSS,
  // while non-empty published-version values replace their page-level fallback.
  if (!page.enable_css_injection || !version.enable_css_injection) return { variables: {}, customCss: '' };
  return {
    variables: Object.keys(version.page_css_variables).length ? version.page_css_variables : page.page_css_variables,
    customCss: version.page_custom_css || page.page_custom_css || '',
  };
}

function compileThemeCss(theme: Theme | null, page: Page, version: Version): string {
  const pageCss = effectivePageCss(page, version);
  const variables = { ...(theme?.css_variables ?? {}), ...(theme?.colors ?? {}), ...pageCss.variables };
  const variableCss = cssRecord(variables);
  return [
    variableCss ? `:root {\n${variableCss}\n}` : '',
    theme?.custom_css ?? '',
    theme ? styleCss(theme.component_styles, theme.breakpoints) : '',
    theme ? styleCss(theme.image_styles, theme.breakpoints) : '',
    theme ? styleCss(theme.gallery_styles, theme.breakpoints) : '',
    theme ? styleCss(theme.carousel_styles, theme.breakpoints) : '',
    pageCss.customCss,
  ].filter(Boolean).join('\n\n');
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
    if (pages.length !== segments.length + 1 || current.path_pattern) return null;

    const versions = await Promise.all(pages.map(page => reader.version(page.id, at)));
    const currentVersion = versions.at(-1);
    if (!currentVersion || currentVersion.page_id !== current.id) return null;
    const chain = pages.flatMap((page, index) => versions[index]
      ? [{ page, version: versions[index]!, depth: pages.length - 1 - index }]
      : []);
    const layout = [...chain].reverse().find(item => item.version.code_layout)?.version.code_layout || 'main_layout';
    const slotNames = new Set([...(LAYOUT_SLOTS[layout] ?? []), ...chain.flatMap(item => Object.keys(object(item.version.widgets)))]);
    const slots = Object.fromEntries([...slotNames].map(slot => [
      slot,
      mergeSlot(slot, chain, at),
    ]));
    if (slots.landing_page && !slots.landingPage) slots.landingPage = slots.landing_page;

    const explicitThemeId = [...chain].reverse().find(item => item.version.theme_id)?.version.theme_id;
    const theme = explicitThemeId
      ? await reader.theme(explicitThemeId, root.tenant_id)
      : await reader.defaultTheme(root.tenant_id);

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
        componentStyles: theme?.component_styles ?? {},
      },
      fontCss: theme ? fontImports(theme.fonts) : '',
      themeCss: compileThemeCss(theme, current, currentVersion),
      title: currentVersion.meta_title || current.title,
      description: currentVersion.meta_description || '',
      matchedPath: '/' + segments.join('/'),
      remainingPath: '',
    };
  });
}
