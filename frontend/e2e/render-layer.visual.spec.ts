import { expect, test } from '@playwright/test'
import { RENDER_WIDGET_FIXTURES } from '../src/rendering/fixtures'
import { compileRenderStyles } from '../src/rendering/themeCssCompiler'

const widgets = Object.values(RENDER_WIDGET_FIXTURES).map((widget, index) => ({
  ...structuredClone(widget),
  id: `visual-${index}`,
}))

const compiledTheme = compileRenderStyles({
  theme: {
    fonts: { googleFonts: [{ family: 'Source Sans 3', variants: ['300', '400', '500', '600', '700'], display: 'swap' }] },
    customCss: `
      body{color:#172033;background:#f8fafc;font-family:"Source Sans 3",ui-sans-serif,system-ui,-apple-system,sans-serif}
      h1{font-size:41px;line-height:44px;font-weight:600}h1,h2{margin-bottom:11px}h2{font-size:36px;line-height:43px;font-weight:500}
      h3{font-size:22px;line-height:26px;font-weight:600;margin-top:22px}h3,p{margin-bottom:11px}p{font-size:16px;line-height:22px;font-weight:300}
      ul{list-style-type:disc}ol,ul{margin-top:11px;margin-bottom:11px;padding-left:1.5em}ol{list-style-type:decimal}li{font-size:16px;line-height:22px;font-weight:300}
      a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}.main-layout-wrapper{padding:24px;background:white}
      .widget-item{margin-bottom:18px}.content-widget,.content-card-widget,.banner-widget,.bio-widget,.hero-widget,.section-widget{padding:16px;border:1px solid #dbe3ef;border-radius:8px}
      .content-card-header,.form-description,.news-excerpt{margin:0}
      h1,h2,h3{color:#123e68}a{color:#1264a3}.news-items{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
    `,
  },
})

const model = {
  layout: 'main_layout',
  slots: { header: [], navbar: [], hero: [], main: widgets, sidebar: [], footer: [] },
  context: { preview: true as const },
  themeCss: compiledTheme.css,
  fontUrl: compiledTheme.fontUrl,
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
  if (new URL(page.url()).pathname !== '/__render-frame') {
    await page.goto('/__render-frame')
  }
  await page.locator('html[data-eceee-render-frame-ready="true"]').waitFor({ state: 'attached' })
  await page.evaluate((nextModel) => {
    window.dispatchEvent(new MessageEvent('message', {
      source: window,
      data: { source: 'eceee-render-host', action: 'render', model: nextModel },
    }))
  }, renderModel)
  await expect(page.locator('.site-renderer')).toBeVisible()
}

const expectCanonicalStyles = async (page) => {
  const renderStyles = page.locator('style[data-eceee-render-css]')
  await expect(renderStyles).toHaveCount(1)
  expect(await renderStyles.textContent()).toBe(compiledTheme.css)
  await expect(page.locator('link[data-eceee-render-font]')).toHaveCount(1)
}

test('banner palette colors override theme typography with clean text in the render frame', async ({ page }) => {
  const theme = compileRenderStyles({ theme: {
    colors: { paper: '#ffffff', ocean: '#082f49' },
    customCss: '.cms-content h2,.cms-content h3,.cms-content p{color:#b91c1c}',
  } })
  await openRender(page, {
    layout: 'main_layout', themeCss: theme.css,
    context: { preview: true, componentStyles: { passthrough: { template: '{{passthru}}' } } },
    slots: { main: [{ id: 'banner-colors', type: 'easy_widgets.BannerWidget', config: {
      bannerMode: 'text', textContent: '<h3>Readable heading</h3><p>Readable body</p>',
      textColor: 'paper', backgroundColor: 'ocean', textOutline: 'dark', componentStyle: 'passthrough',
    } }] },
  })
  await expect(page.locator('.banner-widget')).toHaveCSS('background-color', 'rgb(8, 47, 73)')
  for (const tag of ['h3', 'p']) {
    await expect(page.locator(`.banner-text ${tag}`)).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(page.locator(`.banner-text ${tag}`)).toHaveCSS('text-shadow', 'none')
  }
})

for (const viewport of viewports) {
  test(`editor and designer render the shared fixtures at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await openRender(page, model)
    await expect(page.locator('.content-card-header').first()).toHaveCSS('margin', '0px')
    await expect(page.locator('.form-description').first()).toHaveCSS('margin', '0px')
    await expect(page.locator('.news-excerpt').first()).toHaveCSS('margin', '0px')
    await expect(page.locator('.table-caption').first()).toHaveCSS('text-align', 'left')
    const documentWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))
    expect(documentWidth.scroll).toBe(documentWidth.client)
    await expectCanonicalStyles(page)

    await openRender(page, designerModel)
    await expect(page.locator('.designer-preview')).toBeVisible()
    await expectCanonicalStyles(page)
  })
}
