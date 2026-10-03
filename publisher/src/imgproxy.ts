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

export type ResponsiveImageOptions = {
  maxWidth?: unknown;
  maxHeight?: unknown;
  resizeType?: unknown;
  gravity?: unknown;
  quality?: unknown;
  format?: unknown;
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

function pathToken(value: unknown, fallback = ''): string {
  const token = String(value ?? '').trim().toLowerCase();
  return /^[a-z0-9_-]+$/.test(token) ? token : fallback;
}

function signedResizeUrl(sourceUrl: string, width: number, height: number, options: ResponsiveImageOptions = {}): string | null {
  const key = hexSecret('PUBLISHER_IMGPROXY_KEY', 'IMGPROXY_KEY');
  const salt = hexSecret('PUBLISHER_IMGPROXY_SALT', 'IMGPROXY_SALT');
  if (!key || !salt) return null;

  const encodedSource = Buffer.from(sourceUrl).toString('base64url');
  const resizeType = pathToken(options.resizeType, 'fit');
  const gravity = pathToken(options.gravity);
  const format = pathToken(options.format);
  const quality = positiveNumber(options.quality);
  const processing = [
    `resize:${resizeType}:${width}:${height}`,
    gravity && gravity !== 'sm' ? `gravity:${gravity}` : '',
    quality ? `quality:${Math.min(100, Math.floor(quality))}` : '',
    format ? `format:${format}` : '',
  ].filter(Boolean).join('/');
  const path = `/${processing}/${encodedSource}`;
  const signature = createHmac('sha256', key).update(Buffer.concat([salt, Buffer.from(path)])).digest('base64url');
  return `${publicBaseUrl()}/${signature}${path}`;
}

function constrainedDimensions(width: number, height: number, maxWidth: number | null, maxHeight: number | null): [number, number] {
  if (!maxWidth && !maxHeight) return [width, height];
  const scale = Math.min(maxWidth ? maxWidth / width : 1, maxHeight ? maxHeight / height : 1, 1);
  return [Math.max(1, Math.floor(width * scale)), Math.max(1, Math.floor(height * scale))];
}

export function responsiveImageSources(image: ImageRecord, sourceUrl: string, options?: ResponsiveImageOptions): ResponsiveImageSources | null {
  const width = positiveNumber(image.width ?? image.originalWidth ?? image.original_width);
  const height = positiveNumber(image.height ?? image.originalHeight ?? image.original_height);
  const dpr = positiveNumber(image.dpr) ?? 2;
  const maxWidth = positiveNumber(options?.maxWidth);
  const maxHeight = positiveNumber(options?.maxHeight);
  if ((!width || !height) && (!options || !maxWidth || !maxHeight)) return null;
  if (!options && dpr <= 1) return null;

  let displayWidth: number;
  let displayHeight: number;
  let twoXWidth: number;
  let twoXHeight: number;
  if (width && height) {
    [displayWidth, displayHeight] = options
      ? constrainedDimensions(width, height, maxWidth, maxHeight)
      : [Math.max(1, Math.floor(width / dpr)), Math.max(1, Math.floor(height / dpr))];
    [twoXWidth, twoXHeight] = constrainedDimensions(width, height, displayWidth * 2, displayHeight * 2);
  } else {
    displayWidth = Math.max(1, Math.floor(maxWidth!));
    displayHeight = Math.max(1, Math.floor(maxHeight!));
    twoXWidth = displayWidth * 2;
    twoXHeight = displayHeight * 2;
  }
  const oneX = signedResizeUrl(sourceUrl, displayWidth, displayHeight, options);
  const twoX = signedResizeUrl(sourceUrl, twoXWidth, twoXHeight, options);
  if (!oneX || !twoX) return null;
  return { src: oneX, srcSet: `${oneX} 1x, ${twoX} 2x`, oneX, twoX, displayWidth, displayHeight };
}
