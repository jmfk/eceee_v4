import { chromium } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../..')
const manifestPath = path.join(repoRoot, 'backend/content_migration/legacy_news/samples/manifest.json')
const outputRoot = path.join(repoRoot, 'artifacts/legacy-news-migration')
const djangoBase = (process.env.NEWS_MIGRATION_DJANGO_BASE_URL || 'http://migration-preview.localhost:10101').replace(/\/$/, '')
const reactBase = (process.env.NEWS_MIGRATION_REACT_BASE_URL || 'http://127.0.0.1:10100').replace(/\/$/, '')
const siteId = process.env.NEWS_MIGRATION_SITE_ID

if (!siteId || !/^\d+$/.test(siteId)) {
  throw new Error('Set NEWS_MIGRATION_SITE_ID to the migration-preview-site root page ID.')
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const viewports = [
  { name: 'mobile', width: 375, height: 900 },
  { name: 'desktop', width: 1440, height: 1000 },
]
const surfaces = ['django-public', 'standalone-react', 'editor-preview', 'designer-preview']
for (const surface of surfaces) {
  for (const viewport of viewports) await mkdir(path.join(outputRoot, surface, viewport.name), { recursive: true })
}

const browser = await chromium.launch()
try {
  for (const viewport of viewports) {
    for (const sample of manifest.samples) {
      const slug = sample.slug
      const djangoPage = await browser.newPage({ viewport })
      await djangoPage.goto(`${djangoBase}/migration-preview/news/${slug}/`, { waitUntil: 'networkidle' })
      await djangoPage.locator('[data-widget-type="news-detail"]').waitFor()
      await djangoPage.screenshot({
        path: path.join(outputRoot, 'django-public', viewport.name, `${slug}.png`),
        fullPage: true,
        animations: 'disabled',
      })
      await djangoPage.close()

      const standalone = await browser.newPage({ viewport })
      await standalone.addInitScript(() => {
        window.__ECEEE_CAPTURE_RENDER_MODEL__ = true
        window.addEventListener('eceee-standalone-render-ready', (event) => {
          window.__legacyNewsMigrationModel = event.detail?.model
        })
      })
      await standalone.goto(`${reactBase}/_render/${siteId}/migration-preview/news/${slug}`, { waitUntil: 'networkidle' })
      await standalone.locator('[data-widget-type="news-detail"]').waitFor()
      await standalone.screenshot({
        path: path.join(outputRoot, 'standalone-react', viewport.name, `${slug}.png`),
        fullPage: true,
        animations: 'disabled',
      })
      const model = await standalone.evaluate(() => window.__legacyNewsMigrationModel)
      if (!model) throw new Error(`Could not capture the render model for ${slug}`)

      const editor = await browser.newPage({ viewport })
      await editor.goto(`${reactBase}/__render-frame`)
      await editor.evaluate((renderModel) => {
        window.dispatchEvent(new MessageEvent('message', {
          source: window,
          data: { source: 'eceee-render-host', action: 'render', model: renderModel },
        }))
      }, model)
      await editor.locator('[data-widget-type="news-detail"]').waitFor()
      await editor.locator('body').screenshot({
        path: path.join(outputRoot, 'editor-preview', viewport.name, `${slug}.png`),
        animations: 'disabled',
      })
      await editor.close()
      await standalone.close()

      const designer = await browser.newPage({ viewport })
      await designer.goto(`${reactBase}/__render-frame`)
      await designer.evaluate((renderModel) => {
        window.dispatchEvent(new MessageEvent('message', {
          source: window,
          data: {
            source: 'eceee-render-host',
            action: 'render',
            model: {
              ...renderModel,
              designer: {
                catalog: {
                  layouts: [{
                    key: renderModel.layout || 'main_layout',
                    slots: Object.keys(renderModel.slots || {}).map((name) => ({ name, label: name })),
                  }],
                  designGroups: [],
                },
                texts: {}, images: {}, assets: [],
              },
            },
          },
        }))
      }, model)
      await designer.locator('[data-widget-type="news-detail"]').waitFor()
      await designer.screenshot({
        path: path.join(outputRoot, 'designer-preview', viewport.name, `${slug}.png`),
        fullPage: true,
        animations: 'disabled',
      })
      await designer.close()
    }
  }
} finally {
  await browser.close()
}

console.log(`Captured ${manifest.samples.length * viewports.length * surfaces.length} screenshots in ${outputRoot}`)
