import { expect, test } from '@playwright/test'
import { mockCmsApi, seedAuthenticatedSession, testTokens } from './fixtures/apiMocks'

test.describe('CMS auth and page management regressions', () => {
  test('redirects protected routes to login when no session is available', async ({ page }) => {
    await mockCmsApi(page)

    await page.goto('/pages')

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'EASY v4' })).toBeVisible()
    await expect(page.getByLabel('Username')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
  })

  test('logs in with JWT credentials and returns to the requested pages route', async ({ page }) => {
    await mockCmsApi(page)

    await page.goto('/pages')
    await page.getByLabel('Username').fill('admin')
    await page.getByLabel('Password').fill('blarg123')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page).toHaveURL(/\/pages$/)
    await expect(page.getByText('Summer Study')).toBeVisible()
    await expect(page.getByText('summerstudy.local')).toBeVisible()

    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('access_token'))).toBe(testTokens.access)
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('refresh_token'))).toBe(testTokens.refresh)
  })

  test('renders the authenticated pages workspace from API data', async ({ page }) => {
    await mockCmsApi(page, { authenticated: true })
    await seedAuthenticatedSession(page)

    await page.goto('/pages')

    await expect(page.getByRole('link', { name: /EASY v4/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pages' })).toBeVisible()
    await expect(page.getByPlaceholder('Search pages...')).toBeVisible()
    await expect(page.getByText('Summer Study')).toBeVisible()
    await expect(page.getByText('Published')).toBeVisible()
    await expect(page.getByText('1 root page')).toBeVisible()
  })

  for (const viewport of [
    { name: 'small phone', width: 320, height: 720 },
    { name: 'phone', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'small desktop', width: 1024, height: 768 },
    { name: 'desktop', width: 1440, height: 900 },
  ]) {
    test(`keeps the pages workspace and help menu usable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await mockCmsApi(page, { authenticated: true })
      await seedAuthenticatedSession(page)

      await page.goto('/pages')

      await expect(page.getByPlaceholder('Search pages...')).toBeVisible()
      await expect(page.getByTestId('page-tree-node-summer-study')).toBeVisible()

      const documentOverflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      )
      expect(documentOverflows).toBe(false)

      await page.getByRole('button', { name: 'Open Pages help' }).click()
      const helpMenu = page.getByTestId('contextual-help-menu')
      await expect(helpMenu).toBeVisible()
      await expect(helpMenu.getByRole('menuitem', { name: /create a page/i })).toBeVisible()

      const menuBox = await helpMenu.boundingBox()
      expect(menuBox).not.toBeNull()
      expect(menuBox.x).toBeGreaterThanOrEqual(0)
      expect(menuBox.y).toBeGreaterThanOrEqual(0)
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width)
      expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height)

      await page.getByRole('button', { name: 'Deleted' }).click()
      await expect(page.getByPlaceholder('Search deleted pages...')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'No Deleted Pages' })).toBeVisible()
      expect(await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      )).toBe(false)
    })
  }

  for (const viewport of [
    { name: 'phone', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
  ]) {
    test(`keeps complex nested rows, action overflow, and the bottom bar usable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await mockCmsApi(page, { authenticated: true, responsivePages: true })
      await seedAuthenticatedSession(page)

      await page.goto('/pages')

      const rootId = 'summer-study'
      const childId = 'published-conference-programme-with-long-title'
      const nestedId = 'speaker-resources-downloads'
      const deepestId = 'accessibility-checklist-session-chairs'

      await expect(page.getByTestId(`page-tree-node-${rootId}`)).toBeVisible()
      await expect(page.getByTestId(`page-tree-node-${childId}`)).toBeVisible()
      await expect(page.getByText('Draft', { exact: true })).toBeVisible()
      await expect(page.getByText('Scheduled', { exact: true })).toBeVisible()
      await expect(page.getByLabel('Missing hostname')).toBeVisible()
      await page.getByTestId(`page-tree-expand-${childId}`).click()
      await expect(page.getByTestId(`page-tree-node-${nestedId}`)).toBeVisible()
      await page.getByTestId(`page-tree-expand-${nestedId}`).click()
      await expect(page.getByTestId(`page-tree-node-${deepestId}`)).toBeVisible()

      const rootRegions = await Promise.all([
        page.getByTestId(`page-tree-identity-${rootId}`).boundingBox(),
        page.getByTestId(`page-tree-metadata-${rootId}`).boundingBox(),
        page.getByTestId(`page-tree-primary-actions-${rootId}`).boundingBox(),
      ])
      expect(rootRegions.every(Boolean)).toBe(true)

      const overlaps = (first, second) => {
        const overlapWidth = Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x)
        const overlapHeight = Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y)
        return overlapWidth > 1 && overlapHeight > 1
      }
      expect(overlaps(rootRegions[0], rootRegions[1])).toBe(false)
      expect(overlaps(rootRegions[0], rootRegions[2])).toBe(false)
      expect(overlaps(rootRegions[1], rootRegions[2])).toBe(false)

      await expect(page.getByTestId(`page-tree-edit-${rootId}`)).toBeVisible()
      await expect(page.getByTestId(`page-tree-add-child-${rootId}`)).toBeVisible()
      await page.getByTestId(`page-tree-actions-${rootId}`).click()

      const actionMenu = page.getByTestId(`page-tree-actions-menu-${rootId}`)
      await expect(actionMenu).toBeVisible()
      await expect(actionMenu.getByRole('menuitem', { name: 'Cut' })).toBeVisible()
      await expect(actionMenu.getByRole('menuitem', { name: 'Import as child' })).toBeVisible()
      await expect(actionMenu.getByRole('menuitem', { name: 'Delete' })).toBeVisible()

      const menuBox = await actionMenu.boundingBox()
      expect(menuBox.x).toBeGreaterThanOrEqual(0)
      expect(menuBox.y).toBeGreaterThanOrEqual(0)
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width)
      expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height)
      await page.keyboard.press('Escape')
      await expect(actionMenu).toBeHidden()

      const deepestRow = page.getByTestId(`page-tree-node-${deepestId}`)
      await deepestRow.scrollIntoViewIfNeeded()
      const deepestBox = await deepestRow.boundingBox()
      const statusBar = page.getByTestId('status-bar')
      const statusBox = await statusBar.boundingBox()
      expect(deepestBox.y + deepestBox.height).toBeLessThanOrEqual(statusBox.y + 1)
      await expect(page.getByTestId('status-bar-actions')).toBeVisible()

      expect(await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      )).toBe(false)
    })
  }
})
