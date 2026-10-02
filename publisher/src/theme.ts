import manifest from './generated/publisher-manifest.json';
import type { Page, Theme, Version, Widget } from './model';

type JsonObject = Record<string, unknown>;
type WidgetManifest = { css: string; cssVariables: Record<string, string>; layoutParts: Record<string, { selector: string | null; relationship: string }>; variants: Array<{ id?: string; type?: string; config_field?: string }> };

const object = (value: unknown): JsonObject => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const kebab = (value: string) => value.includes('_') ? value.replaceAll('_', '-') : value.replace(/([A-Z])/g, '-$1').toLowerCase();
const cssName = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '-');

function cssRecord(input: JsonObject): string {
  return Object.entries(input)
    .filter(([name, candidate]) => /^[a-zA-Z0-9_-]+$/.test(name) && ['string', 'number'].includes(typeof candidate))
    .map(([name, candidate]) => `  --${name.replace(/^--/, '')}: ${String(candidate)};`)
    .join('\n');
}

export function fontImports(fonts: JsonObject): string {
  const configured = fonts.google_fonts ?? fonts.googleFonts;
  if (!Array.isArray(configured)) return '';
  return configured.flatMap(font => {
    const definition = object(font);
    const family = String(definition.family ?? '').trim().replace(/\s+/g, '+');
    if (!family) return [];
    const variants = Array.isArray(definition.variants) ? definition.variants.map(String).filter(value => /^\d+$/.test(value)) : [];
    const display = /^(auto|block|fallback|optional|swap)$/.test(String(definition.display)) ? String(definition.display) : 'swap';
    return [`@import url('https://fonts.googleapis.com/css2?family=${family}${variants.length ? `:wght@${variants.join(';')}` : ''}&display=${display}');`];
  }).join('\n');
}

function breakpoints(theme: Theme): Record<string, number> {
  const result: Record<string, number> = { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 };
  for (const [name, value] of Object.entries(theme.breakpoints)) {
    const pixels = Number(value);
    if (Number.isFinite(pixels) && pixels >= 0) result[name] = pixels;
  }
  return result;
}

function styleCss(styles: Record<string, Record<string, unknown>>, theme: Theme, label: string): string {
  const points = breakpoints(theme);
  const blocks = Object.entries(styles).flatMap(([key, style]) => {
    const css = style.css;
    if (typeof css === 'string' && css) return [`/* ${label}: ${String(style.name ?? key)} */\n${css}`];
    const responsive = object(css);
    const rules = Object.entries(responsive).flatMap(([name, block]) => {
      if (typeof block !== 'string' || !block) return [];
      if (name === 'default') return [block];
      return points[name] ? [`@media (min-width: ${points[name]}px) {\n${block}\n}`] : [];
    });
    return rules.length ? [`/* ${label}: ${String(style.name ?? key)} */\n${rules.join('\n\n')}`] : [];
  });
  return blocks.join('\n\n');
}

function selectedStyles(theme: Theme, slots: Record<string, Widget[]>): {
  component: Set<string>; image: Set<string>; gallery: Set<string>; carousel: Set<string>;
} {
  const selected = { component: new Set<string>(), image: new Set<string>(), gallery: new Set<string>(), carousel: new Set<string>() };
  const visitWidget = (widget: Widget) => {
    const mediaItems = array(widget.config.mediaItems ?? widget.config.media_items);
    for (const [key, raw] of Object.entries(widget.config)) {
      if (typeof raw !== 'string' || !/(?:Style|_style)$/.test(key)) continue;
      if (raw in theme.component_styles) selected.component.add(raw);
      if (widget.type === 'easy_widgets.ImageWidget' && mediaItems.length) {
        if (raw in theme.image_styles) selected.image.add(raw);
        if (raw in theme.gallery_styles) selected.gallery.add(raw);
        if (raw in theme.carousel_styles) selected.carousel.add(raw);
      }
    }
    const visit = (candidate: unknown) => {
      if (Array.isArray(candidate)) return candidate.forEach(visit);
      if (!candidate || typeof candidate !== 'object') return;
      const record = candidate as Record<string, unknown>;
      if (typeof record.type === 'string' && record.config && typeof record.config === 'object') visitWidget(record as unknown as Widget);
      else Object.values(record).forEach(visit);
    };
    Object.values(widget.config).forEach(visit);
    if (widget.data) Object.values(widget.data).forEach(visit);
  };
  Object.values(slots).flat().forEach(visitWidget);
  return selected;
}

function pickStyles(styles: Record<string, Record<string, unknown>>, selected: Set<string>): Record<string, Record<string, unknown>> {
  return Object.fromEntries([...selected].flatMap(name => styles[name] ? [[name, styles[name]]] : []));
}

function widgetCss(): string {
  const widgets = manifest.widgets as Record<string, WidgetManifest>;
  const variables: Record<string, string> = {};
  const rules: string[] = [];
  for (const [type, widget] of Object.entries(widgets)) {
    Object.assign(variables, widget.cssVariables);
    if (widget.css) rules.push(`/* Widget: ${type} */\n${widget.css}`);
  }
  const variableRules = cssRecord(variables);
  return [variableRules ? `:root {\n${variableRules}\n}` : '', ...rules].filter(Boolean).join('\n\n');
}

function variantSelector(variantId: unknown, widgetTypes: unknown[]): string {
  const widgets = manifest.widgets as Record<string, WidgetManifest>;
  let type = 'class';
  for (const widgetType of widgetTypes) {
    const variant = widgets[String(widgetType)]?.variants.find(candidate => candidate.id === variantId);
    if (variant) { type = variant.type || 'class'; break; }
  }
  if (type === 'attribute') return `[${String(variantId)}]`;
  if (type === 'pseudo-class') return `:${String(variantId)}`;
  return `.${String(variantId)}`;
}

function baseSelectors(group: JsonObject, scope = ''): { selectors: string[]; widgetTypes: unknown[]; variants: unknown[]; modifier: string } {
  const widgetTypes = array(group.widgetTypes ?? group.widget_types);
  const singleWidget = group.widgetType ?? group.widget_type;
  if (!widgetTypes.length && singleWidget) widgetTypes.push(singleWidget);
  const slots = array(group.slots);
  if (!slots.length && group.slot) slots.push(group.slot);
  const variants = array(group.variants);
  if (!variants.length && group.variant) variants.push(group.variant);
  const modifier = String(group.cssModifier ?? group.css_modifier ?? '');
  if ((group.targetingMode ?? group.targeting_mode ?? 'widget-slot') === 'css-classes') {
    const selectors = String(group.targetCssClasses ?? group.target_css_classes ?? '').split(/[,\n]/).map(value => value.trim()).filter(Boolean);
    return { selectors: selectors.length ? selectors : [scope], widgetTypes, variants, modifier };
  }
  if (!widgetTypes.length && !slots.length) return { selectors: [scope], widgetTypes, variants, modifier };
  if (!widgetTypes.length) return { selectors: slots.map(slot => `${scope}.slot-${cssName(slot)}`), widgetTypes, variants, modifier };
  if (!slots.length) return { selectors: widgetTypes.map(type => `${scope}.widget-type-${cssName(type)}`), widgetTypes, variants, modifier };
  return { selectors: widgetTypes.flatMap(type => slots.map(slot => `${scope}.slot-${cssName(slot)}>.widget-type-${cssName(type)}`)), widgetTypes, variants, modifier };
}

function normalizeFont(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const generic = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);
  return value.split(',').map(font => {
    const clean = font.trim().replace(/["']/g, '');
    return clean.includes(' ') && !generic.has(clean) ? `"${clean}"` : clean;
  }).join(', ');
}

function propertyRules(styles: JsonObject, colors: JsonObject, element = ''): string[] {
  return Object.entries(styles).flatMap(([rawName, rawValue]) => {
    if (rawName === 'images') return [];
    if (rawName === 'background_image' || rawName === 'backgroundImage') {
      const image = object(rawValue);
      const url = image.imgproxyBaseUrl ?? image.imgproxy_base_url ?? image.fileUrl ?? image.file_url ?? image.publicUrl ?? image.public_url ?? image.url;
      if (!url && typeof rawValue !== 'string') return [];
      const result = [`  background-image: url('${String(url ?? rawValue)}');`];
      for (const [key, snakeKey, cssProperty] of [['backgroundSize', 'background_size', 'background-size'], ['backgroundPosition', 'background_position', 'background-position'], ['backgroundRepeat', 'background_repeat', 'background-repeat']] as const) {
        const value = image[key] ?? image[snakeKey];
        if (value) result.push(`  ${cssProperty}: ${String(value)};`);
      }
      if ((image.useAspectRatio ?? image.use_aspect_ratio) === true && (image.aspectRatio ?? image.aspect_ratio)) result.push(`  aspect-ratio: ${String(image.aspectRatio ?? image.aspect_ratio)};`);
      return result;
    }
    let name = kebab(rawName);
    if ((element === 'ul' || element === 'ol') && rawName === 'bulletType') name = 'list-style-type';
    let value = rawName === 'fontFamily' || rawName === 'font_family' ? normalizeFont(rawValue) : rawValue;
    if (['color', 'background-color', 'border-color', 'border-left-color', 'border-right-color', 'border-top-color', 'border-bottom-color'].includes(name) && typeof value === 'string' && value in colors) value = `var(--${value})`;
    if (!['string', 'number'].includes(typeof value)) return [];
    const duplicate = /^([-\d.]+)(px|rem|em|%|vh|vw|ch|ex)\2+$/.exec(String(value));
    return [`  ${name}: ${duplicate ? `${duplicate[1]}${duplicate[2]}` : String(value)};`];
  });
}

function designGroupsCss(theme: Theme): string {
  const groups = array(object(theme.design_groups).groups).map(object);
  if (!groups.length) return legacyElementsCss(theme.html_elements);
  const points = breakpoints(theme);
  const widgets = manifest.widgets as Record<string, WidgetManifest>;
  const result: string[] = [];
  for (const group of groups) {
    const { selectors, widgetTypes, variants, modifier } = baseSelectors(group);
    const variant = variants.map(item => variantSelector(item, widgetTypes)).join('');
    for (const [element, styles] of Object.entries(object(group.elements))) {
      const rules = propertyRules(object(styles), theme.colors, element);
      if (!rules.length) continue;
      const targets = selectors.map(base => variant ? `${base ? `${base} ` : ''}${variant} ${element}${modifier}` : `${base ? `${base} ` : ''}${element}${modifier}`);
      result.push(`${targets.join(',\n')} {\n${rules.join('\n')}\n}`);
    }
    const layout = object(group.layoutProperties ?? group.layout_properties);
    const metadata: Record<string, { selector: string | null; relationship: string }> = {};
    for (const type of widgetTypes) Object.assign(metadata, widgets[String(type)]?.layoutParts ?? {});
    for (const [part, rawBreakpoints] of Object.entries(layout)) {
      const values = object(rawBreakpoints);
      const keys = [...new Set(['xs', 'sm', 'md', 'lg', 'xl', ...Object.keys(values).filter(key => /^\d+$/.test(key))])]
        .filter(key => key === 'xs' || key in values)
        .sort((left, right) => (points[left] ?? Number(left)) - (points[right] ?? Number(right)));
      for (const key of keys) {
        const properties = key === 'xs'
          ? { ...object(values.default), ...object(values.mobile), ...object(values.xs) }
          : key === 'sm'
            ? { ...object(values.desktop), ...object(values.sm) }
            : key === 'md' ? object(values.md ?? values.tablet) : object(values[key]);
        const rules = propertyRules(properties, theme.colors);
        if (!rules.length) continue;
        const partMeta = metadata[part] ?? { selector: null, relationship: 'auto' };
        let relationship = partMeta.relationship || 'auto';
        if (relationship === 'auto') relationship = part.endsWith('-widget') || part === 'container' ? 'same-element' : 'descendant';
        const targets = selectors.map(base => {
          if (partMeta.selector) return `${base ? `${base} ` : ''}${partMeta.selector}${variant}${modifier}`;
          if (!base) return `.${part}${variant}${modifier}`;
          if (relationship === 'same-element') return `${base}.${part}${variant}${modifier}`;
          if (relationship === 'direct-child') return `${base}>.${part}${variant}${modifier}`;
          return `${base} .${part}${variant}${modifier}`;
        });
        const rule = `${targets.join(',\n')} {\n${rules.join('\n')}\n}`;
        const pixels = points[key] ?? Number(key);
        result.push(key === 'xs' ? rule : `@media (min-width: ${pixels}px) {\n  ${rule.replaceAll('\n', '\n  ')}\n}`);
      }
    }
  }
  return result.join('\n\n');
}

function legacyElementsCss(elements: JsonObject): string {
  return Object.entries(elements).flatMap(([element, styles]) => {
    const rules = propertyRules(object(styles), {});
    return rules.length ? [`${element} {\n${rules.join('\n')}\n}`] : [];
  }).join('\n\n');
}

function effectivePageCss(page: Page, version: Version): { variables: JsonObject; customCss: string } {
  if (!page.enable_css_injection || !version.enable_css_injection) return { variables: {}, customCss: '' };
  return {
    variables: Object.keys(version.page_css_variables).length ? version.page_css_variables : page.page_css_variables,
    customCss: version.page_custom_css || page.page_custom_css || '',
  };
}

export function widgetVariantClasses(type: string, config: JsonObject): string {
  const widget = (manifest.widgets as Record<string, WidgetManifest>)[type];
  return (widget?.variants ?? []).filter(variant => {
    if (!variant.id || !variant.config_field) return false;
    const camelField = variant.config_field.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    return config[variant.config_field] === true || config[camelField] === true;
  }).map(variant => variant.id).join(' ');
}

export function compileThemeCss(theme: Theme | null, page: Page, version: Version, slots: Record<string, Widget[]> = {}): string {
  const pageCss = effectivePageCss(page, version);
  const colors = theme?.colors && Object.keys(theme.colors).length ? theme.colors : theme?.css_variables ?? {};
  const variables = { ...colors, ...pageCss.variables };
  const variableCss = cssRecord(variables);
  const styles = theme ? selectedStyles(theme, slots) : null;
  return [
    manifest.baseCss,
    widgetCss(),
    variableCss ? `:root {\n${variableCss}\n}` : '',
    theme ? designGroupsCss(theme) : '',
    theme && styles ? styleCss(pickStyles(theme.component_styles, styles.component), theme, 'Component') : '',
    theme && styles ? styleCss(pickStyles(theme.image_styles, styles.image), theme, 'Image') : '',
    theme && styles ? styleCss(pickStyles(theme.gallery_styles, styles.gallery), theme, 'Gallery') : '',
    theme && styles ? styleCss(pickStyles(theme.carousel_styles, styles.carousel), theme, 'Carousel') : '',
    theme?.custom_css ?? '',
    pageCss.customCss,
  ].filter(Boolean).join('\n\n');
}
