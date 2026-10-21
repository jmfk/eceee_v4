import { expect, test } from '@playwright/test'
import { defaultTextOutlineStyles } from '../src/utils/textOutlineStyles'
import { createCollaborativeEditorState, mockCmsApi, seedAuthenticatedSession } from './fixtures/apiMocks'
import { openCmsPage } from './fixtures/navigation'

const editorPath = '/pages/101/edit/content'

const installErrorGuards = page => {
  page.on('console', message => {
    const isExpectedUnloadTelemetryError = message.text().startsWith(
      'ECEEE Analytics: Failed to flush events TypeError: Failed to fetch'
    )
    if (message.type() === 'error' && !isExpectedUnloadTelemetryError) {
      throw new Error(`Console error: ${message.text()}`)
    }
  })

  page.on('pageerror', error => {
    throw error
  })
}

const openEditor = async (page, editorState) => {
  await seedAuthenticatedSession(page)
  await openCmsPage(page, editorPath)
  await expect(page.getByTestId('page-editor-surface')).toBeVisible()
  await expect(page.getByTestId('content-widget-editor-content-intro').locator('[contenteditable="true"]')).toBeVisible()
  return editorState
}

const contentEditor = (page, widgetId = 'content-intro') =>
  page.getByTestId(`content-widget-editor-${widgetId}`).locator('[contenteditable="true"]')

const setContenteditableHtml = async (locator, html) => {
  await locator.evaluate((element, nextHtml) => {
    element.innerHTML = nextHtml
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: element.textContent }))
  }, html)
}

const setEditorHtml = async (page, widgetId, html) => {
  await setContenteditableHtml(contentEditor(page, widgetId), html)
}

const saveCurrentVersion = async page => {
  await page.getByRole('button', { name: /^Save$/ }).click()
  await expect(page.getByText(/Working version saved/)).toBeVisible()
}

const getSavedVersion = editorState => editorState.savedVersions.at(-1)

test.describe('page editor regressions', () => {
  test.beforeEach(async ({ page }) => {
    installErrorGuards(page)
  })

  test('inline rich-text edit persists after save and reload', async ({ page }) => {
    const editorState = await mockCmsApi(page, { authenticated: true, pageEditor: true })
    await openEditor(page, editorState)

    await setEditorHtml(page, 'content-intro', '<p>Saved rich text copy</p>')
    await expect(contentEditor(page)).toContainText('Saved rich text copy')

    await saveCurrentVersion(page)
    expect(editorState.savedVersions).toHaveLength(1)
    expect(getSavedVersion(editorState).widgets.main[0].config).toEqual({
      content: '<p>Saved rich text copy</p>',
      isActive: true,
    })

    await page.reload()
    await expect(page.getByTestId('page-editor-surface')).toBeVisible()
    await expect(contentEditor(page)).toContainText('Saved rich text copy')
  })

  for (const scheme of ['light', 'dark']) {
    test(`nested banner styling persists with a compact icon toolbar in ${scheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await page.setViewportSize({ width: scheme === 'dark' ? 390 : 1280, height: 960 })
      const editorState = createCollaborativeEditorState()
      editorState.version.effectiveTheme = {
        colors: { paper: '#ffffff', ocean: '#082f49' }, textOutlineStyles: defaultTextOutlineStyles(),
        customCss: 'h2,h3,p{color:#b91c1c}',
      }
      editorState.page.effectiveTheme = editorState.version.effectiveTheme
      const sibling = { id: 'column-sibling', type: 'easy_widgets.HeadlineWidget', config: { content: 'Keep this column' } }
      editorState.version.widgets.main.push({
        id: 'banner-columns', type: 'easy_widgets.TwoColumnsWidget', config: { slots: {
          left: [sibling],
          right: [{ id: 'nested-styled-banner', type: 'easy_widgets.BannerWidget', config: {
            bannerMode: 'header', headerContent: 'Readable banner', textContent: '<p>Stored body</p>',
          } }],
        } },
      })
      await mockCmsApi(page, { authenticated: true, pageEditor: true, editorState })
      await openEditor(page, editorState)
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), scheme === 'dark')

      const banner = page.locator('[data-widget-id="nested-styled-banner"]')
      const editor = banner.locator('[contenteditable="true"]')
      await expect(editor).toHaveText('Readable banner')
      await editor.evaluate(element => { window.__bannerEditorElement = element })
      const toolbar = banner.getByRole('toolbar', { name: 'Banner controls' })
      await banner.hover()
      await expect(toolbar).toBeVisible()
      expect(await toolbar.locator('button').allTextContents()).toEqual(['', '', '', ''])
      await toolbar.getByRole('button', { name: 'Text color', exact: true }).focus()
      await expect(page.getByText('Text color', { exact: true })).toBeVisible()
      await toolbar.getByRole('button', { name: 'Text color', exact: true }).press('Enter')
      await expect(toolbar.getByRole('button', { name: 'Text color', exact: true })).toHaveAttribute('aria-expanded', 'true')
      await expect(page.getByRole('group', { name: 'Text color', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'paper', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'paper', exact: true }).click()
      await expect(toolbar.getByRole('button', { name: 'Text color', exact: true })).toBeFocused()
      await toolbar.getByRole('button', { name: 'Background color', exact: true }).click()
      const palette = page.getByRole('group', { name: 'Background color', exact: true })
      const paletteBox = await palette.boundingBox()
      expect(paletteBox.x).toBeGreaterThanOrEqual(0)
      expect(paletteBox.x + paletteBox.width).toBeLessThanOrEqual(page.viewportSize().width)
      await page.getByRole('button', { name: 'ocean', exact: true }).click()
      await toolbar.getByRole('combobox', { name: 'Text outline' }).selectOption('dark')
      await expect(editor).toHaveCSS('color', 'rgb(255, 255, 255)')
      await expect(banner.locator('.banner-widget')).toHaveCSS('background-color', 'rgb(8, 47, 73)')
      await expect(editor).not.toHaveCSS('text-shadow', 'none')
      expect(await editor.evaluate(element => element === window.__bannerEditorElement)).toBe(true)
      await banner.screenshot({ path: `test-results/banner-styling-${scheme}.png` })

      await saveCurrentVersion(page)
      const savedColumns = getSavedVersion(editorState).widgets.main.find(widget => widget.id === 'banner-columns')
      expect(savedColumns.config.slots.left).toEqual([sibling])
      expect(savedColumns.config.slots.right[0].config).toMatchObject({
        textColor: 'paper', backgroundColor: 'ocean', textOutline: 'dark', textContent: '<p>Stored body</p>',
      })
      await page.reload()
      await expect(page.getByTestId('page-editor-surface')).toBeVisible({ timeout: 30_000 })
      await expect(editor).toHaveCSS('color', 'rgb(255, 255, 255)')
      await expect(editor).not.toHaveCSS('text-shadow', 'none')
      await expect(banner.locator('.banner-widget')).toHaveCSS('background-color', 'rgb(8, 47, 73)')
    })
  }

  test('banner presentation controls retain selected rich text and its formatting toolbar', async ({ page }) => {
    const editorState = createCollaborativeEditorState()
    const theme = { colors: { paper: '#ffffff', ocean: '#082f49' }, textOutlineStyles: defaultTextOutlineStyles() }
    editorState.version.effectiveTheme = theme
    editorState.page.effectiveTheme = theme
    editorState.version.widgets.main.push({
      id: 'selected-banner', type: 'easy_widgets.BannerWidget',
      config: { bannerMode: 'text', textContent: '<p>Readable copy</p>' },
    })
    await mockCmsApi(page, { authenticated: true, pageEditor: true, editorState })
    await openEditor(page, editorState)
    const banner = page.locator('[data-widget-id="selected-banner"]')
    const editor = banner.locator('[contenteditable="true"]')
    await editor.evaluate(element => {
      element.focus()
      const range = document.createRange()
      range.setStart(element.querySelector('p').firstChild, 0)
      range.setEnd(element.querySelector('p').firstChild, 8)
      window.getSelection().removeAllRanges()
      window.getSelection().addRange(range)
    })
    const toolbar = banner.getByRole('toolbar', { name: 'Banner controls' })
    const formatting = page.locator('.global-wysiwyg-toolbar')
    await expect(formatting).toBeInViewport()
    await toolbar.getByRole('button', { name: 'Text color', exact: true }).click()
    await toolbar.getByRole('combobox', { name: 'Text outline' }).selectOption('dark')
    await expect(editor).toBeFocused()
    await toolbar.getByRole('button', { name: 'Text color', exact: true }).click()
    // Outlast the editor's blur delay while keyboard focus is inside the palette.
    await page.waitForTimeout(300)
    await expect(formatting).toBeInViewport()
    await page.getByRole('button', { name: 'paper', exact: true }).click()
    await expect(editor).toBeFocused()
    expect(await page.evaluate(() => window.getSelection().toString())).toBe('Readable')
    await page.waitForTimeout(300)
    await expect(formatting).toBeInViewport()
    await formatting.getByRole('button', { name: 'Bold', exact: true }).click()
    await expect(editor.locator('b,strong')).toHaveText('Readable')
    await expect(editor).toHaveText('Readable copy')
    // Keyboard users can close the palette and resume the same selection too.
    await toolbar.getByRole('button', { name: 'Background color', exact: true }).focus()
    await toolbar.getByRole('button', { name: 'Background color', exact: true }).press('Enter')
    await page.getByRole('button', { name: 'paper', exact: true }).press('Escape')
    await expect(editor).toBeFocused()
    expect(await page.evaluate(() => window.getSelection().toString())).toBe('Readable')
  })

  test('page settings stay in the working version until publish', async ({ page }) => {
    const editorState = await mockCmsApi(page, { authenticated: true, pageEditor: true })
    await openEditor(page, editorState)

    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByPlaceholder('Page Title').fill('Unpublished draft title')
    await page.getByPlaceholder('page-url-slug').fill('unpublished-draft-slug')
    await saveCurrentVersion(page)

    expect(editorState.savedPages).toHaveLength(0)
    expect(getSavedVersion(editorState).pageData.pageAttributes).toMatchObject({
      title: 'Unpublished draft title',
      slug: 'unpublished-draft-slug',
    })
  })

  test('theme selection lives in Settings and legacy theme links redirect', async ({ page }) => {
    await mockCmsApi(page, { authenticated: true, pageEditor: true })
    await seedAuthenticatedSession(page)

    await openCmsPage(page, '/pages/101/edit/theme')

    await expect(page).toHaveURL(/\/pages\/101\/edit\/settings$/)
    await expect(page.getByTestId('page-editor-tab-settings')).toContainText('Settings')
    await expect(page.getByRole('heading', { name: 'Page Theme' })).toBeVisible()
    await expect(page.getByTestId('page-editor-tab-theme')).toHaveCount(0)
  })

  test('external widget config update reaches the rendered content', async ({ page }) => {
    const editorState = await mockCmsApi(page, { authenticated: true, pageEditor: true })
    await openEditor(page, editorState)

    await page.evaluate(() => {
      window.__UNIFIED_DATA__.dispatch({
        type: 'UPDATE_WIDGET_CONFIG',
        sourceId: 'playwright-external-config',
        payload: {
          id: 'content-intro',
          slotName: 'main',
          contextType: 'page',
          pageId: '101',
          config: { content: '<p>Externally patched copy</p>' },
        },
      })
    })

    await expect(contentEditor(page)).toContainText('Externally patched copy')
  })

  test('inline edit survives same-widget external config churn without focus loss or duplication', async ({ page }) => {
    const editorState = await mockCmsApi(page, { authenticated: true, pageEditor: true })
    await openEditor(page, editorState)

    await contentEditor(page).evaluate(element => {
      element.focus()
      element.innerHTML = '<p>Inline draft before config panel</p>'
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: 'Inline draft before config panel',
      }))
    })
    await expect(contentEditor(page)).toContainText('Inline draft before config panel')
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('contenteditable'))).toBe('true')

    await page.evaluate(() => {
      window.__UNIFIED_DATA__.dispatch({
        type: 'UPDATE_WIDGET_CONFIG',
        sourceId: 'playwright-config-panel',
        payload: {
          id: 'content-intro',
          slotName: 'main',
          contextType: 'page',
          pageId: '101',
          config: { content: '<p>Inline draft before config panel plus panel suffix</p>' },
        },
      })
    })

    await expect(contentEditor(page)).toContainText('Inline draft before config panel plus panel suffix')
    await expect.poll(() => contentEditor(page).evaluate(element =>
      (element.textContent.match(/Inline draft before config panel/g) || []).length
    )).toBe(1)
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('contenteditable'))).toBe('true')

    await saveCurrentVersion(page)
    expect(getSavedVersion(editorState).widgets.main[0].config.content).toBe(
      '<p>Inline draft before config panel plus panel suffix</p>'
    )
  })

  test('rapid sequential edits preserve the last update without reordering', async ({ page }) => {
    const editorState = await mockCmsApi(page, { authenticated: true, pageEditor: true })
    await openEditor(page, editorState)

    await contentEditor(page).evaluate(element => {
      for (const value of ['First rapid edit', 'Second rapid edit', 'Third rapid edit']) {
        element.innerHTML = `<p>${value}</p>`
        element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }))
      }
    })

    await expect(contentEditor(page)).toContainText('Third rapid edit')

    await saveCurrentVersion(page)
    const savedWidgets = getSavedVersion(editorState).widgets.main
    expect(savedWidgets.map(widget => widget.id)).toEqual(['content-intro', 'content-sidebar', 'headline-main'])
    expect(savedWidgets[0].config).toEqual({
      content: '<p>Third rapid edit</p>',
      isActive: true,
    })
  })

  test('add, delete, and move widget actions update the saved page structure', async ({ page }) => {
    const editorState = await mockCmsApi(page, { authenticated: true, pageEditor: true })
    await openEditor(page, editorState)

    await page.getByTestId('page-widget-move-down-easy-widgets-contentwidget').first().click()

    await page.getByTestId('page-widget-delete-easy-widgets-contentwidget').nth(1).click()
    await page.getByRole('button', { name: 'Delete Widget', exact: true }).click()

    await page.getByTestId('page-slot-add-main').click()
    await page.getByTestId('page-widget-option-easy-widgets-contentwidget').click()

    await expect(page.getByTestId('page-editor-slot-main').locator('.page-editor-widget')).toHaveCount(3)

    await saveCurrentVersion(page)

    const savedWidgets = getSavedVersion(editorState).widgets.main
    expect(savedWidgets).toHaveLength(3)
    expect(savedWidgets[0].id).toBe('content-sidebar')
    expect(savedWidgets[1].id).toBe('headline-main')
    expect(savedWidgets[2].type).toBe('easy_widgets.ContentWidget')
    expect(savedWidgets[2].id).not.toBe('content-intro')
  })

  test('same-page cut and paste removes the original once and keeps the pasted widget', async ({ page }) => {
    const editorState = await mockCmsApi(page, { authenticated: true, pageEditor: true })
    await openEditor(page, editorState)

    await page.getByTestId('page-widget-cut-easy-widgets-contentwidget').first().click()
    await expect.poll(() => editorState.clipboard.widgets?.operation).toBe('cut')

    await page.getByTestId('page-widget-paste-easy-widgets-contentwidget').nth(1).click()
    await expect(page.getByTestId('page-editor-slot-main').locator('.page-editor-widget')).toHaveCount(3)

    await saveCurrentVersion(page)

    const savedWidgets = getSavedVersion(editorState).widgets.main
    expect(savedWidgets).toHaveLength(3)
    expect(savedWidgets.map(widget => widget.id)).not.toContain('content-intro')
    expect(savedWidgets.map(widget => widget.id)).toContain('content-sidebar')
    expect(savedWidgets.map(widget => widget.id)).toContain('headline-main')

    const pastedWidget = savedWidgets.find(widget =>
      widget.id !== 'content-sidebar' && widget.id !== 'headline-main'
    )
    expect(pastedWidget).toBeTruthy()
    expect(pastedWidget.id).not.toBe('content-intro')
    expect(pastedWidget.type).toBe('easy_widgets.ContentWidget')
    expect(pastedWidget.config.content).toBe('<p>Initial editor copy</p>')
  })

  test('headline widget inline edit saves through the canonical widget payload', async ({ page }) => {
    const editorState = await mockCmsApi(page, { authenticated: true, pageEditor: true })
    await openEditor(page, editorState)

    const headlineEditor = page.locator('.widget-type-easy-widgets-headlinewidget [contenteditable="true"]')
    await expect(headlineEditor).toContainText('Initial headline')

    await headlineEditor.evaluate(element => {
      element.textContent = 'Canonical headline update'
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: 'Canonical headline update',
      }))
    })

    await expect(headlineEditor).toContainText('Canonical headline update')

    await saveCurrentVersion(page)

    const savedHeadline = getSavedVersion(editorState).widgets.main.find(widget => widget.id === 'headline-main')
    expect(savedHeadline.config).toEqual({
      anchor: '',
      content: 'Canonical headline update',
      componentStyle: 'default',
      showBorder: true,
      headerLevel: 'h1',
    })
  })

  test('hero and content card edits save final canonical configs together', async ({ page }) => {
    const editorState = await mockCmsApi(page, { authenticated: true, pageEditor: true })
    editorState.version.widgets.main.push(
      {
        id: 'hero-main',
        type: 'easy_widgets.HeroWidget',
        name: 'Hero',
        config: {
          header: 'Initial hero headline',
          beforeText: '',
          afterText: '',
          image: null,
          backgroundColor: '#111827',
          textColor: '#ffffff',
          decorColor: '#ffffff',
          componentStyle: 'default',
        },
      },
      {
        id: 'card-main',
        type: 'easy_widgets.ContentCardWidget',
        name: 'Content Card',
        config: {
          anchor: '',
          header: 'Initial card heading',
          content: '<p>Initial card body</p>',
          image1: null,
          imageSize: 'square',
          componentStyle: 'default',
        },
      }
    )

    await openEditor(page, editorState)

    const heroHeaderEditor = page.locator('.widget-type-easy-widgets-herowidget [contenteditable="true"]').nth(1)
    const cardBodyEditor = page.locator('.widget-type-easy-widgets-contentcardwidget [contenteditable="true"]').nth(1)

    await expect(heroHeaderEditor).toContainText('Initial hero headline')
    await expect(cardBodyEditor).toContainText('Initial card body')

    await setContenteditableHtml(heroHeaderEditor, 'Edited hero headline')
    await setContenteditableHtml(cardBodyEditor, '<p>Edited card body</p>')

    await expect(heroHeaderEditor).toContainText('Edited hero headline')
    await expect(cardBodyEditor).toContainText('Edited card body')

    await saveCurrentVersion(page)

    const savedWidgets = getSavedVersion(editorState).widgets.main
    const savedHero = savedWidgets.find(widget => widget.id === 'hero-main')
    const savedCard = savedWidgets.find(widget => widget.id === 'card-main')
    const untouchedSibling = savedWidgets.find(widget => widget.id === 'content-sidebar')

    expect(savedHero.config).toEqual(expect.objectContaining({
      header: 'Edited hero headline',
      beforeText: '',
      afterText: '',
    }))
    expect(savedCard.config).toEqual(expect.objectContaining({
      header: 'Initial card heading',
      content: '<p>Edited card body</p>',
    }))
    expect(untouchedSibling.config.content).toBe('<p>Second widget copy</p>')
  })
})

test.describe('page editor collaboration', () => {
  test('two browser contexts merge different widgets and show advisory presence', async ({ browser }) => {
    const shared = createCollaborativeEditorState()
    const contextA = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const contextB = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()
    installErrorGuards(pageA)
    installErrorGuards(pageB)
    await mockCmsApi(pageA, { authenticated: true, pageEditor: true, editorState: shared })
    await mockCmsApi(pageB, { authenticated: true, pageEditor: true, editorState: shared })

    try {
      await Promise.all([openEditor(pageA, shared), openEditor(pageB, shared)])
      await expect(pageA.getByTestId('page-editor-presence')).toBeVisible()
      await expect(pageB.getByTestId('page-editor-presence')).toBeVisible()

      await setEditorHtml(pageA, 'content-intro', '<p>Editor A copy</p>')
      await setEditorHtml(pageB, 'content-sidebar', '<p>Editor B copy</p>')
      await saveCurrentVersion(pageA)
      await expect(contentEditor(pageB, 'content-intro')).toContainText('Editor A copy')
      await saveCurrentVersion(pageB)

      expect(shared.version.widgets.main.find(widget => widget.id === 'content-intro').config.content)
        .toBe('<p>Editor A copy</p>')
      expect(shared.version.widgets.main.find(widget => widget.id === 'content-sidebar').config.content)
        .toBe('<p>Editor B copy</p>')
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })

  test('two browser contexts require a choice for the same rich-text field', async ({ browser }) => {
    const shared = createCollaborativeEditorState()
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()
    installErrorGuards(pageA)
    installErrorGuards(pageB)
    await mockCmsApi(pageA, { authenticated: true, pageEditor: true, editorState: shared })
    await mockCmsApi(pageB, { authenticated: true, pageEditor: true, editorState: shared })

    try {
      await Promise.all([openEditor(pageA, shared), openEditor(pageB, shared)])
      await setEditorHtml(pageA, 'content-intro', '<p>Editor A wins?</p>')
      await setEditorHtml(pageB, 'content-intro', '<p>Editor B wins?</p>')
      await saveCurrentVersion(pageA)

      await expect(pageB.getByRole('heading', { name: 'Resolve Conflicts' })).toBeVisible()
      await expect(pageB.getByRole('button', { name: 'Keep All Local' })).toBeVisible()
      await expect(pageB.getByRole('button', { name: 'Accept All Server' })).toBeVisible()
      const savesBeforeResolution = shared.savedVersions.length
      await pageB.getByRole('button', { name: 'Keep All Local' }).click()
      await pageB.getByRole('button', { name: 'Save with Resolutions' }).click()

      await expect(pageB.getByRole('heading', { name: 'Resolve Conflicts' })).not.toBeVisible()
      await expect.poll(() => shared.savedVersions.length).toBeGreaterThan(savesBeforeResolution)
      await expect.poll(() => (
        shared.version.widgets.main.find(widget => widget.id === 'content-intro').config.content
      )).toBe('<p>Editor B wins?</p>')
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })
})

const mockPanelSchemas = async (page, extraFields = {}) => {
  const requests = []
  await page.route('**/api/v1/webpages/widget-types/*/validate/', route =>
    route.fulfill({ json: { errors: {}, warnings: {} } }))
  await page.route('**/api/v1/webpages/widget-types/*/config-ui-schema/', route => {
    const type = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-3))
    requests.push(type)
    return route.fulfill({ json: { schema: { properties: {
      content: { type: 'string', component: type.includes('Headline') ? 'RichTextInput' : 'HtmlSource',
        inlineOnly: type.includes('Headline'), title: 'Panel content', group: 'Content' },
      title: { type: 'string', component: 'TextInput', title: 'Panel title', group: 'Content' },
      ...extraFields,
    } } } })
  })
  return requests
}

test.describe('stable widget side panel', () => {
  test('rapid conditional-group edits keep the same richtext field and final saved value', async ({ page }) => {
    installErrorGuards(page)
    const state = await mockCmsApi(page, { authenticated: true, pageEditor: true })
    state.version.widgets.main[0].config.settings = { activeGroup: 'text', formData: { text: { body: 'Old' } } }
    await page.route('**/pydantic-models/TestConfig/schema/', route => route.fulfill({ json: { schema: { properties: {
      body: { type: 'string', component: 'RichTextInput', title: 'Group body' }
    } } } }))
    await mockPanelSchemas(page, { settings: { type: 'object', component: 'ConditionalGroupField', title: 'Settings', group: 'Content',
      groups: { text: { label: 'Text', configModel: 'TestConfig' } } } })
    await openEditor(page, state)
    await page.getByTestId('page-widget-edit-easy-widgets-contentwidget').first().click()
    const editor = page.getByRole('textbox', { name: 'Group body', exact: true })
    await expect(editor).toHaveText('Old')
    await editor.evaluate(element => {
      element.focus()
      element.dataset.kept = 'true'
      for (const body of ['First local', 'Latest local']) {
        element.innerHTML = body
        element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
      }
      const range = document.createRange()
      range.selectNodeContents(element)
      window.getSelection().removeAllRanges()
      window.getSelection().addRange(range)
    })
    await expect(editor).toHaveAttribute('data-kept', 'true')
    await expect(editor).toHaveText('Latest local')
    expect(await editor.evaluate(element => document.activeElement === element && window.getSelection().toString())).toBe('Latest local')
    await saveCurrentVersion(page)
    expect(getSavedVersion(state).widgets.main[0].config.settings.formData.text.body).toBe('Latest local')
  })

  test('closes an open field link dialog on client-side navigation', async ({ page }) => {
    installErrorGuards(page)
    const state = await mockCmsApi(page, { authenticated: true, pageEditor: true })
    await mockPanelSchemas(page)
    await openEditor(page, state)
    await page.getByRole('button', { name: 'Back to Pages', exact: true }).click()
    await expect(page).toHaveURL(/\/pages$/)
    await page.goBack()
    await expect(page.getByTestId('page-editor-surface')).toBeVisible()
    await page.getByTestId('page-widget-edit-easy-widgets-contentwidget').first().click()
    const editor = page.getByRole('textbox', { name: 'Panel content', exact: true })
    await editor.focus()
    await page.getByRole('toolbar', { name: 'Panel content formatting' }).getByTitle('Insert/Edit Link', { exact: true }).click()
    await expect(page.locator('#link-picker-modal-container')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible()
    await page.goForward()
    await expect(page).toHaveURL(/\/pages$/)
    await expect(page.locator('#link-picker-modal-container')).toHaveCount(0)
  })

  test('body paste and paragraph formatting preserve unrelated markup, undo and save/reload', async ({ page }) => {
    installErrorGuards(page)
    const state = await mockCmsApi(page, { authenticated: true, pageEditor: true })
    const untouched = '<span class="highlight" style="color:red" data-note="keep">Existing</span>'
    state.version.widgets.main[0].config.content = `<p>${untouched}</p><p>Target</p>`
    await mockPanelSchemas(page)
    await openEditor(page, state)
    await page.getByTestId('page-widget-edit-easy-widgets-contentwidget').first().click()
    const rich = page.getByRole('textbox', { name: 'Panel content', exact: true })
    await expect(rich.locator('.highlight')).toHaveText('Existing')
    const paste = async (type = 'text/html', content = '<p>Pasted</p>') => rich.evaluate((element, data) => {
      element.focus()
      const range = document.createRange()
      range.selectNodeContents(element.lastChild)
      range.collapse(false)
      window.getSelection().removeAllRanges()
      window.getSelection().addRange(range)
      const clipboardData = new DataTransfer()
      clipboardData.setData(data.type, data.content)
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }))
    }, { type, content })
    await paste()
    await expect(rich).toContainText('Pasted')
    expect(await rich.locator('.highlight').evaluate(element => element.outerHTML)).toBe(untouched)
    await rich.press('ControlOrMeta+z')
    await expect(rich).not.toContainText('Pasted')
    await paste('text/plain', '<b>Literal</b>')
    await expect(rich).toContainText('<b>Literal</b>')
    await expect(rich.locator('b')).toHaveCount(0)
    await rich.press('ControlOrMeta+z')
    await expect(rich).not.toContainText('Literal')
    await paste()
    await rich.evaluate(element => {
      const range = document.createRange()
      range.selectNodeContents(element.lastChild)
      window.getSelection().removeAllRanges()
      window.getSelection().addRange(range)
    })
    const toolbar = page.getByRole('toolbar', { name: 'Panel content formatting' })
    await toolbar.getByRole('button', { name: /^Text format:/ }).click()
    await toolbar.getByRole('button', { name: 'Heading 2', exact: true }).click()
    await expect(rich.locator('h2')).toContainText('Pasted')
    expect(await rich.locator('.highlight').evaluate(element => element.outerHTML)).toBe(untouched)
    await saveCurrentVersion(page)
    expect(getSavedVersion(state).widgets.main[0].config.content).toContain(untouched)
    await page.reload()
    await page.getByTestId('page-widget-edit-easy-widgets-contentwidget').first().click()
    expect(await rich.locator('.highlight').evaluate(element => element.outerHTML)).toBe(untouched)
    await expect(rich.locator('h2')).toContainText('Pasted')
  })

  test('formatting controls never edit a different richtext field', async ({ page }) => {
    installErrorGuards(page)
    await page.setViewportSize({ width: 1280, height: 600 })
    const state = await mockCmsApi(page, { authenticated: true, pageEditor: true })
    state.version.widgets.main[0].config.secondBody = '<p>Second field</p>'
    await mockPanelSchemas(page, { secondBody: { type: 'string', component: 'RichTextInput', title: 'Second body', group: 'Content' } })
    await openEditor(page, state)
    await page.getByTestId('page-widget-edit-easy-widgets-contentwidget').first().click()
    const first = page.getByRole('textbox', { name: 'Panel content', exact: true })
    await expect(first).toHaveText('Initial editor copy')
    const original = await first.innerHTML()
    await first.evaluate(element => {
      element.focus()
      const range = document.createRange()
      range.selectNodeContents(element)
      window.getSelection().removeAllRanges()
      window.getSelection().addRange(range)
    })
    await page.getByRole('toolbar', { name: 'Second body formatting' }).getByTitle('Bold', { exact: true }).click()
    expect(await first.innerHTML()).toBe(original)
    const second = page.getByRole('textbox', { name: 'Second body', exact: true })
    await expect(second).toBeFocused()
    await page.keyboard.insertText('X')
    await expect(second.locator('b, strong')).toHaveText('X')
    await saveCurrentVersion(page)
    expect(getSavedVersion(state).widgets.main[0].config.content).toBe(original)
    expect(getSavedVersion(state).widgets.main[0].config.secondBody).toMatch(/<(b|strong)>X<\/(b|strong)>/)
  })

  test('allows keyboard navigation out of richtext fields in both directions', async ({ page }) => {
    installErrorGuards(page)
    const state = await mockCmsApi(page, { authenticated: true, pageEditor: true })
    await mockPanelSchemas(page)
    await openEditor(page, state)
    await page.getByTestId('page-widget-edit-easy-widgets-headlinewidget').click()
    const rich = page.getByRole('textbox', { name: 'Panel content', exact: true })
    await expect(rich).toContainText('Initial headline')
    await rich.focus()
    await rich.press('Tab')
    await expect(page.getByRole('textbox', { name: 'Panel title', exact: true })).toBeFocused()
    await rich.focus()
    await rich.press('Shift+Tab')
    await expect.poll(() => page.getByRole('toolbar', { name: 'Panel content formatting' })
      .evaluate(element => element.contains(document.activeElement))).toBe(true)
  })

  for (const [markupType, original] of [
    ['embedded HTML', '<span>Original copy</span><iframe src="https://example.test/embed"></iframe>'],
    ['inline images and attributes', '<span class="legacy-label" style="color:red" data-note="keep">Original copy</span><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="Logo">']
  ]) {
    test(`preserves ${markupType} in richtext fields through source editing and save/reload`, async ({ page }) => {
      installErrorGuards(page)
      const state = await mockCmsApi(page, { authenticated: true, pageEditor: true })
      state.version.widgets.main.find(widget => widget.id === 'headline-main').config.content = original
      await mockPanelSchemas(page)
      await openEditor(page, state)
      await page.getByTestId('page-widget-edit-easy-widgets-headlinewidget').click()
      await expect(page.getByRole('textbox', { name: 'Panel content', exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Open HTML Editor' }).click()
      const source = page.locator('.html-editor-overlay .cm-content')
      await expect(source).toHaveText(original)
      await source.focus()
      await source.press('ControlOrMeta+a')
      const updated = original.replace('Original copy', 'Edited copy')
      await page.keyboard.insertText(updated)
      await source.press('Escape')
      await saveCurrentVersion(page)
      expect(getSavedVersion(state).widgets.main.find(widget => widget.id === 'headline-main').config.content).toBe(updated)
      await page.reload()
      await page.getByTestId('page-widget-edit-easy-widgets-headlinewidget').click()
      await page.getByRole('button', { name: 'Open HTML Editor' }).click()
      await expect(page.locator('.html-editor-overlay .cm-content')).toHaveText(updated)
    })
  }

  test('preserves input selection and schema while typing and saves the final keystroke', async ({ page }) => {
    installErrorGuards(page)
    const state = await mockCmsApi(page, { authenticated: true, pageEditor: true })
    state.version.widgets.main[0].config.title = 'Initial panel title'
    const schemaRequests = await mockPanelSchemas(page)
    await openEditor(page, state)
    await page.getByTestId('page-widget-edit-easy-widgets-contentwidget').first().click()
    const title = page.getByRole('textbox', { name: 'Panel title', exact: true })
    await expect(title).toHaveValue('Initial panel title')
    const requestCount = schemaRequests.length
    await title.fill('Final panel title')
    await title.evaluate(element => { element.dataset.kept = 'true'; element.setSelectionRange(2, 7) })
    await expect.poll(() => title.evaluate(element => [element.dataset.kept, element.selectionStart, element.selectionEnd,
      document.activeElement === element])).toEqual(['true', 2, 7, true])
    expect(schemaRequests).toHaveLength(requestCount)
    await saveCurrentVersion(page)
    expect(getSavedVersion(state).widgets.main[0].config.title).toBe('Final panel title')
    await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0)
    await page.reload()
    await expect(contentEditor(page)).toContainText('Initial editor copy')
    await page.getByTestId('page-widget-edit-easy-widgets-contentwidget').first().click()
    await expect(page.getByRole('textbox', { name: 'Panel title', exact: true })).toHaveValue('Final panel title')
  })

  test('richtext formatting and native undo survive value echoes and save/reload', async ({ page }) => {
    installErrorGuards(page)
    const state = await mockCmsApi(page, { authenticated: true, pageEditor: true })
    await mockPanelSchemas(page)
    await openEditor(page, state)
    await page.getByTestId('page-widget-edit-easy-widgets-headlinewidget').click()
    const rich = page.getByRole('textbox', { name: 'Panel content', exact: true })
    await expect(rich).toContainText('Initial headline')
    await rich.evaluate(element => {
      element.dataset.kept = 'true'
      element.focus()
      const range = document.createRange()
      range.selectNodeContents(element)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
    })
    await page.getByRole('toolbar', { name: 'Panel content formatting' }).getByTitle('Bold', { exact: true }).click()
    await expect(rich.locator('b, strong')).toHaveText('Initial headline')
    await rich.press('ArrowRight')
    await page.keyboard.insertText('X')
    await expect(rich).toContainText('Initial headlineX')
    await rich.press('ControlOrMeta+z')
    await expect(rich).toHaveText('Initial headline')
    await expect(rich).toHaveAttribute('data-kept', 'true')
    await saveCurrentVersion(page)
    expect(getSavedVersion(state).widgets.main.find(widget => widget.id === 'headline-main').config.content).toMatch(/<(b|strong)>/)
    await page.screenshot({ path: 'test-results/side-column-richtext.png', fullPage: true })
    await page.reload()
    await page.getByTestId('page-widget-edit-easy-widgets-headlinewidget').click()
    await expect(page.getByRole('textbox', { name: 'Panel content', exact: true }).locator('b, strong')).toHaveText('Initial headline')
  })

  test('switches between widgets of the same type without losing either draft', async ({ page }) => {
    installErrorGuards(page)
    const state = await mockCmsApi(page, { authenticated: true, pageEditor: true })
    await mockPanelSchemas(page)
    await openEditor(page, state)
    await page.getByTestId('page-widget-edit-easy-widgets-contentwidget').first().click()
    await page.getByRole('textbox', { name: 'Panel content', exact: true }).fill('First widget draft')
    await page.getByTestId('page-widget-edit-easy-widgets-contentwidget').nth(1).click()
    const second = page.getByRole('textbox', { name: 'Panel content', exact: true })
    await expect(second).not.toContainText('First widget draft')
    await second.fill('Second widget draft')
    await saveCurrentVersion(page)
    const widgets = getSavedVersion(state).widgets.main
    expect(widgets[0].config.content).toMatch(/^(<p>)?First widget draft(<\/p>)?$/)
    expect(widgets[1].config.content).toMatch(/^(<p>)?Second widget draft(<\/p>)?$/)
    await page.reload()
    await expect(contentEditor(page, 'content-intro')).toHaveText('First widget draft')
    await expect(contentEditor(page, 'content-sidebar')).toHaveText('Second widget draft')
  })
})

test('inline widget image controls overlay content at regular and narrow widths', async ({ page }) => {
  const editorState = createCollaborativeEditorState()
  const image = { url: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22600%22%3E%3Crect width=%22400%22 height=%22600%22 fill=%22%2393c5fd%22/%3E%3Ccircle cx=%22200%22 cy=%22250%22 r=%22100%22 fill=%22%23334155%22/%3E%3C/svg%3E', altText: 'Shape fixture' }
  editorState.version.widgets.main.push(
    { id: 'card-inline', type: 'easy_widgets.ContentCardWidget', config: { header: 'Card heading', content: '<p>Card copy</p>', image1: image } },
    { id: 'bio-inline', type: 'easy_widgets.BioWidget', config: { bioText: '<p>Biography</p>', image, imageSize: 'square', caption: 'Portrait caption' } },
    { id: 'image-inline', type: 'easy_widgets.ImageWidget', config: {} },
  )
  await mockCmsApi(page, { authenticated: true, pageEditor: true, editorState })
  await seedAuthenticatedSession(page)
  await openCmsPage(page, editorPath)
  for (const width of [1440, 768]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const label of ['Content card', 'Bio', 'Image']) {
      const toolbar = page.getByRole('toolbar', { name: `${label} controls` })
      await expect(toolbar.locator('button')).toHaveText(label === 'Image' ? [''] : ['', ''])
      await toolbar.locator('..').hover()
      await expect(toolbar).toHaveCSS('opacity', '1')
      const button = toolbar.getByRole('button', { name: 'Image', exact: true })
      await expect(button).toBeEnabled()
      expect(await button.evaluate(element => { const rect = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) })).toBe(true)
      await expect(toolbar.getByRole('button', { name: 'Image', exact: true })).toBeVisible()
      await toolbar.locator('..').screenshot({ path: `/tmp/eceee-inline-${label.replace(' ', '-')}-${width}.png` })
      const bounds = await toolbar.boundingBox()
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    }
    await expect(page.getByRole('img', { name: 'No image selected' })).toBeVisible()
    await page.screenshot({ path: `/tmp/eceee-inline-widgets-${width}.png`, fullPage: true })
  }
  const bio = page.getByRole('toolbar', { name: 'Bio controls' })
  await bio.locator('..').hover()
  await bio.getByRole('button', { name: 'Image size: Square' }).click()
  await expect(bio.getByRole('button', { name: 'Image size: Rectangle' })).toBeVisible()
  await bio.locator('..').screenshot({ path: '/tmp/eceee-inline-Bio-rectangle.png' })
  const card = page.getByRole('toolbar', { name: 'Content card controls' })
  await card.locator('..').hover()
  await card.getByRole('button', { name: 'Image size: Square' }).click()
  await expect(card.getByRole('button', { name: 'Image size: Rectangle' })).toBeVisible()
  await saveCurrentVersion(page)
  expect(getSavedVersion(editorState).widgets.main.find(widget => widget.id === 'card-inline').config.imageSize).toBe('rectangle')
})

test('compact table controls preserve commands and fit desktop and mobile', async ({ page }) => {
  const editorState = createCollaborativeEditorState()
  editorState.version.widgets.main.push({
    id: 'compact-table', type: 'easy_widgets.TableWidget', config: {
      rows: [{ cells: [{ content: 'First cell' }, { content: 'Second cell' }] }],
    },
  })
  await mockCmsApi(page, { authenticated: true, pageEditor: true, editorState })
  await openEditor(page, editorState)
  const table = page.locator('[data-widget-id="compact-table"] table')
  const toolbar = page.getByRole('toolbar', { name: 'Table formatting' })
  for (const width of [1280, 390]) {
    await page.emulateMedia({ colorScheme: width === 390 ? 'dark' : 'light' })
    await page.setViewportSize({ width, height: 960 })
    await table.locator('td').first().click()
    await expect(toolbar).toBeInViewport()
    expect((await toolbar.locator('button').allTextContents()).every(text => text === '')).toBe(true)
    await toolbar.getByRole('combobox', { name: 'Cell text style' }).selectOption('quote')
    await expect(table.locator('td').first()).toHaveClass(/table-cell-quote/)
    for (const button of await toolbar.getByRole('button').all()) {
      const box = await button.boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
    }
    if (width === 390) {
      await toolbar.getByRole('button', { name: 'Colors', exact: true }).click()
      const heading = page.getByRole('heading', { name: 'Cell Colors' })
      await expect(heading).toHaveCSS('color', await toolbar.evaluate(element => getComputedStyle(element).color))
      await expect(heading.locator('..')).not.toHaveCSS('background-color', 'rgb(255, 255, 255)')
      await toolbar.getByRole('button', { name: 'Colors', exact: true }).click()
    }
    await page.locator('.global-table-toolbar').screenshot({ path: `test-results/table-toolbar-${width}.png` })
  }
  await toolbar.getByRole('button', { name: 'Add Row', exact: true }).click()
  await expect(table.locator('tr')).toHaveCount(2)
  await toolbar.getByRole('button', { name: 'Add Column', exact: true }).click()
  await expect(table.locator('tr').first().locator('td')).toHaveCount(3)
  await saveCurrentVersion(page)
  const saved = getSavedVersion(editorState).widgets.main.find(widget => widget.id === 'compact-table').config
  expect(saved.rows).toHaveLength(2)
  expect(saved.rows[0].cells).toHaveLength(3)
  expect(saved.rows[0].cells[0].fontStyle).toBe('quote')
})
