import manifest from '../../frontend/src/rendering/generated/render-manifest.json';
import {
  compileRenderStyles,
  type CompiledRenderStyles,
} from '../../frontend/src/rendering/themeCssCompiler';
import { responsiveImageSources } from './imgproxy';
import type { Page, Theme, Version } from './model';
import type { ThemeSpecialPage } from '../../frontend/src/rendering/types';

type JsonObject = Record<string, unknown>;
type WidgetManifest = { variants: Array<{ id?: string; type?: string; config_field?: string }> };

const object = (value: unknown): JsonObject => value && typeof value === 'object' && !Array.isArray(value)
  ? value as JsonObject
  : {};

export function defaultSpecialPages(): ThemeSpecialPage[] {
  return manifest.defaultSpecialPages as ThemeSpecialPage[];
}

const resolveBackgroundImage = (rawImage: JsonObject): JsonObject => {
  const image = object(rawImage);
  const sourceUrl = image.imgproxyBaseUrl ?? image.imgproxy_base_url
    ?? image.fileUrl ?? image.file_url
    ?? image.publicUrl ?? image.public_url
    ?? image.url;
  if (!sourceUrl) return image;
  const responsive = responsiveImageSources(image, String(sourceUrl));
  return {
    ...image,
    url: String(sourceUrl),
    ...(responsive ? { oneX: responsive.oneX, twoX: responsive.twoX } : {}),
  };
};

export function compilePublisherStyles(
  theme: Theme | null,
  page: Page,
  version: Version,
): CompiledRenderStyles {
  return compileRenderStyles({
    theme: theme as unknown as JsonObject | null,
    page: page as unknown as JsonObject,
    version: version as unknown as JsonObject,
    resolveBackgroundImage,
  });
}

export function widgetVariantClasses(type: string, config: JsonObject): string {
  const widget = (manifest.widgets as Record<string, WidgetManifest>)[type];
  return (widget?.variants ?? []).filter(variant => {
    if (!variant.id || !variant.config_field) return false;
    const camelField = variant.config_field.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    return config[variant.config_field] === true || config[camelField] === true;
  }).map(variant => variant.id).join(' ');
}
