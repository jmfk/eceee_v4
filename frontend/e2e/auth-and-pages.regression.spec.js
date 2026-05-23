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
})
