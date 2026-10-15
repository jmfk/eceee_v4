import { expect, test } from '@playwright/test'

test.describe('retired Django public renderer', () => {
  const expectRendererDisabled = async (response, page) => {
    expect(response?.status()).toBe(410)
    expect(response?.headers()['x-eceee-renderer']).toBe('django-disabled')
    await expect(page.getByText('Public rendering is provided by Next.js.')).toBeVisible()
    await expect(page.getByText(/Traceback|Server Error/i)).toHaveCount(0)
  }

  test('does not render the published home page through Django', async ({ page }) => {
    const response = await page.goto('/')

    await expectRendererDisabled(response, page)
  })

  test('does not render published child pages through Django', async ({ page }) => {
    const response = await page.goto('/about/')

    await expectRendererDisabled(response, page)
  })

  test('blocks Django before resolving missing public pages', async ({ page }) => {
    const response = await page.goto('/missing-public-regression-page/')

    await expectRendererDisabled(response, page)
  })
})
