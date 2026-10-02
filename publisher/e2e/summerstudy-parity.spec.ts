import { expect, test, type Page } from '@playwright/test';

const djangoOrigin = process.env.PARITY_DJANGO_ORIGIN ?? 'http://summerstudy.localhost:10101';
const publisherOrigin = process.env.PARITY_PUBLISHER_ORIGIN ?? 'http://summerstudy.localhost:10115';
const routes = [
  '/', '/about/', '/about/evaluations/', '/for-authors/', '/for-authors/publication-ethics/',
  '/for-authors/review-process/', '/programme/', '/programme/2024-informal-sessions/',
  '/programme/2024plenaries-and-co-chairs/', '/programme/2024-side-events/', '/programme/plenaries/',
  '/registration/', '/registration/code-of-conduct/', '/registration/registration/',
  '/registration/support-contact/', '/venue-travel/',
];
const publishedPaths = new Set(routes);

const importantSelectors = ['.widget-type-header', '.navbar-widget', '.hero-widget', '.main-layout-main', '.footer-widget'];

type Snapshot = {
  hrefs: string[];
  headings: string[];
  images: Array<{ alt: string; source: string }>;
  styles: Record<string, Record<string, string | number> | null>;
  text: string;
  invalidLinks: number;
  emptyImages: number;
  fallbacks: number;
};

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(({ origin, selectors }) => {
    const assetIdentity = (source: string) => {
      try {
        const url = new URL(source, location.href);
        const last = url.pathname.split('/').filter(Boolean).at(-1) ?? '';
        if (url.port === '10106' && last) {
          try {
            const padded = last.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - last.length % 4) % 4);
            return new URL(atob(padded)).pathname;
          } catch { /* keep direct path */ }
        }
        return url.pathname;
      } catch { return source; }
    };
    const hrefs = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
      .map(link => new URL(link.href, location.href))
      .filter(url => url.origin === origin)
      .map(url => url.pathname);
    const styles = Object.fromEntries(selectors.map(selector => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return [selector, null];
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return [selector, {
        display: style.display, width: Math.round(rect.width), height: Math.round(rect.height),
        color: style.color, backgroundColor: style.backgroundColor, fontFamily: style.fontFamily,
        fontSize: style.fontSize, padding: style.padding, margin: style.margin, maxWidth: style.maxWidth,
      }];
    }));
    return {
      hrefs: [...new Set(hrefs)].sort(),
      headings: [...document.querySelectorAll('h1')].map(node => node.textContent?.trim() ?? ''),
      images: [...document.images].filter(image => Boolean(image.getAttribute('src'))).map(image => ({ alt: image.alt, source: assetIdentity(image.currentSrc || image.src) })),
      styles,
      text: document.body.innerText,
      invalidLinks: document.querySelectorAll('a[href="#"],a[href=""]').length,
      emptyImages: [...document.images].filter(image => !image.getAttribute('src')).length,
      fallbacks: document.querySelectorAll('.render-error-state,.render-empty-state').length,
    };
  }, { origin: new URL(page.url()).origin, selectors: importantSelectors });
}

for (const route of routes) {
  test(`${route} matches the Django public renderer`, async ({ browser }) => {
    const context = await browser.newContext();
    const django = await context.newPage();
    const publisher = await context.newPage();
    const errors: string[] = [];
    const failedAssets: string[] = [];
    publisher.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    publisher.on('pageerror', error => errors.push(error.message));
    publisher.on('response', response => {
      if (response.status() >= 400 && response.request().resourceType() !== 'document' && !response.url().endsWith('/favicon.ico')) failedAssets.push(`${response.status()} ${response.url()}`);
    });

    const [djangoResponse, publisherResponse] = await Promise.all([
      django.goto(`${djangoOrigin}${route}`, { waitUntil: 'networkidle' }),
      publisher.goto(`${publisherOrigin}${route}`, { waitUntil: 'networkidle' }),
    ]);
    expect(djangoResponse?.status()).toBe(200);
    expect(publisherResponse?.status()).toBe(200);
    const [expected, actual] = await Promise.all([snapshot(django), snapshot(publisher)]);
    expect(actual.invalidLinks).toBe(0);
    expect(actual.emptyImages).toBe(0);
    expect(actual.fallbacks).toBe(0);
    expect(errors).toEqual([]);
    expect(failedAssets).toEqual([]);
    const expectedPublishedHrefs = expected.hrefs.filter(href => publishedPaths.has(href));
    expect(actual.hrefs.every(href => publishedPaths.has(href))).toBe(true);
    expect(actual.hrefs).toEqual(expectedPublishedHrefs);
    expect(actual.headings).toEqual(expected.headings);
    expect(actual.images).toHaveLength(expected.images.length);
    expect(actual.images.every(image => Boolean(image.source))).toBe(true);
    expect(actual.styles).toEqual(expected.styles);
    if (route === '/' && expected.text.includes('Partner Logos')) {
      expect(actual.text).toContain('Partner Logos');
      expect(actual.images.length).toBeGreaterThanOrEqual(12);
    }
    await context.close();
  });
}
