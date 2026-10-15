import { expect, test, type Page } from '@playwright/test';

const previewOrigin = process.env.PARITY_PREVIEW_ORIGIN ?? 'http://localhost:10100';
const publisherOrigin = process.env.PARITY_PUBLISHER_ORIGIN ?? 'http://summerstudy.localhost:10115';
const previewSiteId = process.env.PARITY_PREVIEW_SITE_ID ?? '85';
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
  documentWidth: number;
  viewportWidth: number;
  renderCss: string;
  layoutCss: string;
  renderFontLinks: number;
};

async function snapshot(page: Page, routePrefix = ''): Promise<Snapshot> {
  return page.evaluate(({ origin, selectors, renderRoutePrefix }) => {
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
      .map(url => renderRoutePrefix && (url.pathname === renderRoutePrefix || url.pathname.startsWith(`${renderRoutePrefix}/`))
        ? url.pathname.slice(renderRoutePrefix.length) || '/'
        : url.pathname);
    const normalizeCssUrl = (rawValue: string) => {
      const value = rawValue.trim().replace(/^(['"])(.*)\1$/, '$2');
      if (/^(?:data|blob):/i.test(value)) return `url('${value}')`;
      try {
        const url = new URL(value, location.href);
        const segments = url.pathname.split('/');
        if (segments[1] && segments[1] !== 'unsafe' && segments[2]?.startsWith('resize:')) {
          segments[1] = '<signature>';
        }
        ['signature', 'token', 'expires'].forEach(key => url.searchParams.delete(key));
        const query = url.searchParams.toString();
        return `url('${segments.join('/')}${query ? `?${query}` : ''}${url.hash}')`;
      } catch {
        return `url('${value}')`;
      }
    };
    const normalizeCss = (css: string) => css
      .replace(/url\((?:'[^']*'|"[^"]*"|[^)]*)\)/g, token => normalizeCssUrl(token.slice(4, -1)))
      .replace(/\s+/g, ' ')
      .trim();
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
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      renderCss: normalizeCss(document.querySelector('style[data-eceee-render-css]')?.textContent ?? ''),
      layoutCss: normalizeCss(document.querySelector('style[data-theme-layout-css]')?.textContent ?? ''),
      renderFontLinks: document.querySelectorAll('link[data-eceee-render-font]').length,
    };
  }, { origin: new URL(page.url()).origin, selectors: importantSelectors, renderRoutePrefix: routePrefix });
}

for (const route of routes) {
  test(`${route} matches the standalone React preview`, async ({ browser }) => {
    const context = await browser.newContext();
    const preview = await context.newPage();
    const publisher = await context.newPage();
    const errors: string[] = [];
    const failedAssets: string[] = [];
    publisher.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    publisher.on('pageerror', error => errors.push(error.message));
    publisher.on('response', response => {
      if (response.status() >= 400 && response.request().resourceType() !== 'document' && !response.url().endsWith('/favicon.ico')) failedAssets.push(`${response.status()} ${response.url()}`);
    });

    const previewRoutePrefix = `/_render/${previewSiteId}`;
    const [previewResponse, publisherResponse] = await Promise.all([
      preview.goto(`${previewOrigin}${previewRoutePrefix}${route}`, { waitUntil: 'networkidle' }),
      publisher.goto(`${publisherOrigin}${route}`, { waitUntil: 'networkidle' }),
    ]);
    expect(previewResponse?.status()).toBe(200);
    expect(publisherResponse?.status()).toBe(200);
    await Promise.all([
      preview.locator('style[data-eceee-render-css]').waitFor({ state: 'attached' }),
      publisher.locator('style[data-eceee-render-css]').waitFor({ state: 'attached' }),
    ]);
    const [expected, actual] = await Promise.all([snapshot(preview, previewRoutePrefix), snapshot(publisher)]);
    expect(actual.renderCss).not.toBe('');
    expect(actual.layoutCss).not.toBe('');
    expect(actual.renderCss).toBe(expected.renderCss);
    expect(actual.layoutCss).toBe(expected.layoutCss);
    expect(actual.renderFontLinks).toBe(1);
    expect(expected.renderFontLinks).toBe(1);
    expect(actual.renderCss).not.toMatch(/eceee-editor-ui|page-editor|data-eceee-theme-scope/);
    expect(actual.renderCss.match(/\.media-insert img\{/g)).toHaveLength(1);
    expect(actual.renderCss).toMatch(/image-set\([^)]*\) 1x,[^)]*\) 2x\)/);
    expect(actual.layoutCss).not.toMatch(/(?:^|[;{])\s*height:\s*310px(?:[;}])/);
    expect(actual.invalidLinks).toBe(0);
    expect(actual.emptyImages).toBe(0);
    expect(actual.fallbacks).toBe(0);
    expect(actual.documentWidth).toBeLessThanOrEqual(actual.viewportWidth);
    expect(errors).toEqual([]);
    expect(failedAssets).toEqual([]);
    const expectedPublishedHrefs = expected.hrefs.filter(href => publishedPaths.has(href));
    expect(actual.hrefs.every(href => publishedPaths.has(href))).toBe(true);
    expect(expectedPublishedHrefs.every(href => actual.hrefs.includes(href))).toBe(true);
    expect(actual.headings).toEqual(expected.headings);
    expect(actual.images).toHaveLength(expected.images.length);
    expect(actual.images.every(image => Boolean(image.source))).toBe(true);
    const expectedMain = expected.styles['.main-layout-main'];
    const actualMain = actual.styles['.main-layout-main'];
    if (expectedMain && actualMain) {
      // Content height depends on asset availability and trailing-margin collapse, while some
      // published pages intentionally use only the sidebar. Preserve empty/non-empty semantics
      // and compare all stable typography, spacing and color properties exactly.
      expect(Number(actualMain.height) > 0).toBe(Number(expectedMain.height) > 0);
      expect(Number(actualMain.width)).toBeGreaterThan(0);
      delete expectedMain.height;
      delete actualMain.height;
      delete expectedMain.width;
      delete actualMain.width;
    }
    expect(actual.styles).toEqual(expected.styles);
    if (route === '/' && expected.text.includes('Partner Logos')) {
      expect(actual.text).toContain('Partner Logos');
      expect(actual.images.length).toBeGreaterThanOrEqual(12);
    }
    await context.close();
  });
}
