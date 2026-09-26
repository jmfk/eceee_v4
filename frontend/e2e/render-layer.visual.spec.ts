import { expect, test } from '@playwright/test'
import { RENDER_WIDGET_FIXTURES } from '../src/rendering/fixtures'

const widgets = Object.values(RENDER_WIDGET_FIXTURES).map((widget, index) => ({
  ...structuredClone(widget),
  id: `visual-${index}`,
}))

const model = {
  layout: 'main_layout',
  slots: { header: [], navbar: [], hero: [], main: widgets, sidebar: [], footer: [] },
  context: { preview: true as const },
  themeCss: `
    body{color:#172033;background:#f8fafc}.main-layout-wrapper{padding:24px;background:white}
    .widget-item{margin-bottom:18px}.content-widget,.content-card-widget,.banner-widget,.bio-widget,.hero-widget,.section-widget{padding:16px;border:1px solid #dbe3ef;border-radius:8px}
    h1,h2,h3{color:#123e68}a{color:#1264a3}.news-items{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
  `,
}

const designerModel = {
  ...model,
  designer: {
    catalog: {
      layouts: [{ key: 'main_layout', slots: [{ name: 'main', label: 'Main content' }] }],
      designGroups: [{ id: 'content-group', label: 'Content', widgetTypes: ['easy_widgets.ContentWidget'], slots: ['main'], parts: [], elements: [{ id: 'content-heading', label: 'Heading', element: 'h2' }], assetKeys: [] }],
    },
    texts: {}, images: {}, assets: [],
  },
}

const viewports = [
  { name: 'mobile', width: 375, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
]

const openRender = async (page, renderModel) => {
  await page.goto('/__render-frame')
  await page.evaluate((nextModel) => {
    window.dispatchEvent(new MessageEvent('message', {
      source: window,
      data: { source: 'eceee-render-host', action: 'render', model: nextModel },
    }))
  }, renderModel)
  await expect(page.locator('.site-renderer')).toBeVisible()
}

for (const viewport of viewports) {
  test(`editor and designer render the shared fixtures at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await openRender(page, model)
    await expect(page).toHaveScreenshot(`render-editor-${viewport.name}.png`, { fullPage: true, animations: 'disabled' })

    await openRender(page, designerModel)
    await expect(page.locator('.designer-preview')).toBeVisible()
    await expect(page).toHaveScreenshot(`render-designer-${viewport.name}.png`, { fullPage: true, animations: 'disabled' })
  })
}
