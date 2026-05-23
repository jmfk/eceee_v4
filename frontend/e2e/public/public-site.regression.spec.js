import { expect, test } from '@playwright/test'

test.describe('public site regressions', () => {
  test('renders the published home page through the public hostname route', async ({ page }) => {
    const response = await page.goto('/')

    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(/Public Regression Home/)
    await expect(page.getByRole('heading', { name: 'Public Regression Home' })).toBeVisible()
    await expect(page.getByText('eceee-public-regression-home')).toBeVisible()
    await expect(page.locator('.layout-slot.slot-main')).toBeVisible()
    await expect(page.getByText(/No site configured|Page not found|Traceback|Server Error/i)).toHaveCount(0)
  })

  test('renders a published child page without exposing the root slug', async ({ page }) => {
    const response = await page.goto('/about/')

    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(/Public Regression About/)
    await expect(page.getByRole('heading', { name: 'Public Regression About' })).toBeVisible()
    await expect(page.getByText('eceee-public-regression-about')).toBeVisible()
    await expect(page).not.toHaveURL(/public-regression-root/)
  })

  test('returns a real 404 for missing public pages instead of a broken render', async ({ page }) => {
    const response = await page.goto('/missing-public-regression-page/')

    expect(response?.status()).toBe(404)
    await expect(page.getByText(/Traceback|Server Error/i)).toHaveCount(0)
  })
})
