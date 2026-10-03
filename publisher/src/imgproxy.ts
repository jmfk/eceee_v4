import { createHmac } from 'node:crypto';

type ImageRecord = {
  width?: unknown;
  height?: unknown;
  originalWidth?: unknown;
  originalHeight?: unknown;
  original_width?: unknown;
  original_height?: unknown;
  dpr?: unknown;
};

export type ResponsiveImageSources = {
  src: string;
  srcSet: string;
  oneX: string;
  twoX: string;
  displayWidth: number;
  displayHeight: number;
};

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function hexSecret(name: 'PUBLISHER_IMGPROXY_KEY' | 'PUBLISHER_IMGPROXY_SALT', fallback: 'IMGPROXY_KEY' | 'IMGPROXY_SALT'): Buffer | null {
  const value = (process.env[name] || process.env[fallback] || '').trim();
  return value && value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value) ? Buffer.from(value, 'hex') : null;
}

function publicBaseUrl(): string {
  return (process.env.PUBLISHER_IMGPROXY_PUBLIC_URL || '/imgproxy').replace(/\/+$/, '');
}

function signedResizeUrl(sourceUrl: string, width: number, height: number): string | null {
  const key = hexSecret('PUBLISHER_IMGPROXY_KEY', 'IMGPROXY_KEY');
  const salt = hexSecret('PUBLISHER_IMGPROXY_SALT', 'IMGPROXY_SALT');
  if (!key || !salt) return null;

  const encodedSource = Buffer.from(sourceUrl).toString('base64url');
  const path = `/resize:fit:${width}:${height}/${encodedSource}`;
  const signature = createHmac('sha256', key).update(Buffer.concat([salt, Buffer.from(path)])).digest('base64url');
  return `${publicBaseUrl()}/${signature}${path}`;
}

export function responsiveImageSources(image: ImageRecord, sourceUrl: string, maxDisplayWidth?: number): ResponsiveImageSources | null {
  const width = positiveNumber(image.width ?? image.originalWidth ?? image.original_width);
  const height = positiveNumber(image.height ?? image.originalHeight ?? image.original_height);
  const dpr = positiveNumber(image.dpr) ?? 2;
  if (!width || !height || (!maxDisplayWidth && dpr <= 1)) return null;

  const displayWidth = Math.max(1, Math.floor(maxDisplayWidth ? Math.min(width, maxDisplayWidth) : width / dpr));
  const displayHeight = Math.max(1, Math.floor(height * displayWidth / width));
  const twoXWidth = Math.min(width, displayWidth * 2);
  const twoXHeight = Math.max(1, Math.floor(height * twoXWidth / width));
  const oneX = signedResizeUrl(sourceUrl, displayWidth, displayHeight);
  const twoX = signedResizeUrl(sourceUrl, twoXWidth, twoXHeight);
  if (!oneX || !twoX) return null;
  return { src: oneX, srcSet: `${oneX} 1x, ${twoX} 2x`, oneX, twoX, displayWidth, displayHeight };
}
