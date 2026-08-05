import { expect, test } from '@playwright/test'
import { mockCmsApi, seedAuthenticatedSession } from './fixtures/apiMocks'

const editorPath = '/pages/101/edit/content'

const installErrorGuards = page => {
  page.on('console', message => {
    if (message.type() === 'error') {
      throw new Error(`Console error: ${message.text()}`)
    }
  })

  page.on('pageerror', error => {
    throw error
  })
}

const openEditor = async (page, editorState) => {
  await seedAuthenticatedSession(page)
  await page.goto(editorPath, { waitUntil: 'domcontentloaded' })
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
  await page.getByRole('button', { name: /Save v3/ }).click()
  await expect(page.getByText('Current version saved')).toBeVisible()
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
