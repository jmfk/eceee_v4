import { expect, test, type Browser, type Page } from '@playwright/test';

const djangoOrigin = process.env.SUPERTEST_DJANGO_ORIGIN ?? 'http://renderer-supertest.localhost:11601';
const publisherOrigin = process.env.SUPERTEST_PUBLISHER_ORIGIN ?? 'http://renderer-supertest.localhost:10115';

async function pair(browser: Browser, route: string) {
  const context = await browser.newContext();
  const django = await context.newPage();
  const publisher = await context.newPage();
  const errors: string[] = [];
  for (const page of [django, publisher]) {
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
  }
  const [djangoResponse, publisherResponse] = await Promise.all([
    django.goto(`${djangoOrigin}${route}`, { waitUntil: 'networkidle' }),
    publisher.goto(`${publisherOrigin}${route}`, { waitUntil: 'networkidle' }),
  ]);
  expect(djangoResponse?.status()).toBe(200);
  expect(publisherResponse?.status()).toBe(200);
  return { context, django, publisher, errors };
}

async function carouselSnapshot(page: Page) {
  const images = page.locator('.carousel-image');
  const track = page.locator('.carousel-track');
  const before = await track.evaluate(element => getComputedStyle(element).transform);
  await page.locator('.carousel-next').click();
  const after = await track.evaluate(element => element.getAttribute('style') || getComputedStyle(element).transform);
  return {
    count: await images.count(),
    images: await images.evaluateAll(elements => elements.map(image => ({
      alt: (image as HTMLImageElement).alt,
      src: (image as HTMLImageElement).getAttribute('src') || '',
    }))),
    before,
    after,
  };
}

test('special widgets are meaningful and interactive in both renderers', async ({ browser }) => {
  const { context, django, publisher, errors } = await pair(browser, '/features/');
  for (const page of [django, publisher]) {
    await expect(page.getByText('Django ↔ Next', { exact: true })).toBeVisible();
    await expect(page.getByText('Carousel, nested layouts, table and form interactions.', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Interaction test' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Name/ })).toHaveAttribute('required', '');
    await expect(page.getByRole('button', { name: 'Submit test' })).toBeVisible();
  }

  const [djangoCarousel, publisherCarousel] = await Promise.all([
    carouselSnapshot(django), carouselSnapshot(publisher),
  ]);
  for (const carousel of [djangoCarousel, publisherCarousel]) {
    expect(carousel.count).toBe(3);
    expect(carousel.images.map(image => image.alt)).toEqual([
      'Supertest slide 1', 'Supertest slide 2', 'Supertest slide 3',
    ]);
    expect(carousel.images.every(image => image.src.startsWith('data:image/svg+xml'))).toBe(true);
    expect(carousel.after).not.toBe(carousel.before);
  }

  for (const page of [django, publisher]) {
    const nested = page.getByText('Nested content is visible.', { exact: true });
    await expect(nested).toBeVisible();
    await page.getByText('Collapse nested content', { exact: true }).click();
    await expect(nested).toBeHidden();
    await page.getByText('Expand nested content', { exact: true }).click();
    await expect(nested).toBeVisible();
  }
  expect(errors).toEqual([]);
  await context.close();
});

test('object list content, order, links and metadata match', async ({ browser }) => {
  const { context, django, publisher, errors } = await pair(browser, '/objects/');
  const expectedTitles = ['Beta object', 'Alpha object', 'Gamma object'];
  const expectedLinks = ['/objects/beta-object/', '/objects/alpha-object/', '/objects/gamma-object/'];
  for (const page of [django, publisher]) {
    const list = page.locator('[data-widget-type="news-list"]');
    await expect(list.locator('.news-title')).toHaveText(expectedTitles);
    const links = await list.locator('.news-title a').evaluateAll(elements => elements.map(link => link.getAttribute('href')));
    expect(links).toEqual(expectedLinks);
    await expect(list.getByText('Pinned', { exact: true })).toHaveCount(1);
    await expect(list.locator('.news-date')).toHaveCount(3);
    await expect(list.locator('.news-excerpt')).toHaveCount(3);
  }
  expect(errors).toEqual([]);
  await context.close();
});

for (const slug of ['alpha-object', 'beta-object', 'gamma-object']) {
  test(`object detail ${slug} matches`, async ({ browser }) => {
    const { context, django, publisher, errors } = await pair(browser, `/objects/${slug}/`);
    const stem = slug.split('-')[0]!;
    const title = `${stem[0]!.toUpperCase()}${stem.slice(1)} object`;
    for (const page of [django, publisher]) {
      await expect(page.locator('[data-widget-type="news-list"] .news-item')).toHaveCount(0);
      const detail = page.locator('[data-widget-type="news-detail"]');
      await expect(detail.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(detail).toContainText(`Deterministic summary for ${title}.`);
      await expect(detail).toContainText(`${title} body`);
      await expect(detail).toContainText('Structured object widget');
      await expect(detail.locator('time')).toHaveCount(1);
    }
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('unknown object slug stays silent in both renderers', async ({ browser }) => {
  const { context, django, publisher, errors } = await pair(browser, '/objects/missing-object/');
  for (const page of [django, publisher]) {
    await expect(page.locator('[data-widget-type="news-detail"]')).toHaveCount(0);
    await expect(page.locator('.render-error-state')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  await context.close();
});

test('generic object list widget matches in both renderers', async ({ browser }) => {
  const { context, django, publisher, errors } = await pair(browser, '/generic-object-list/');
  for (const page of [django, publisher]) {
    const list = page.locator('[data-widget-type="object-list"]');
    await expect(list.locator('.object-title')).toHaveText(['Alpha object', 'Beta object', 'Gamma object']);
    await expect(list.locator('.object-excerpt')).toHaveCount(3);
    await expect(list.locator('.object-date')).toHaveCount(3);
  }
  expect(errors).toEqual([]);
  await context.close();
});

test('generic object detail widget renders structured content in both renderers', async ({ browser }) => {
  const { context, django, publisher, errors } = await pair(browser, '/generic-object-detail/');
  for (const page of [django, publisher]) {
    const detail = page.locator('[data-widget-type="object-detail"]');
    await expect(detail.getByRole('heading', { name: 'Alpha object', exact: true })).toBeVisible();
    await expect(detail).toContainText('Alpha object body');
    await expect(detail).toContainText('Structured object widget 1.');
  }
  expect(errors).toEqual([]);
  await context.close();
});
