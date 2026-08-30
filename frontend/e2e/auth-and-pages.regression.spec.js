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
})
