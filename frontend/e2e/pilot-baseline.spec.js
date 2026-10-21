import { expect, test } from '@playwright/test'

const runtimeErrors = new WeakMap()
test.beforeEach(async ({ page }) => {
    const errors = []
    runtimeErrors.set(page, errors)
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.goto('/e2e/fixtures/pilot-baseline.html')
    await expect(page.getByRole('heading', { name: 'Pilot heading', exact: true })).toBeVisible()
})

test.afterEach(async ({ page }) => {
    expect(runtimeErrors.get(page)).toEqual([])
})

test('all four types retain content, ordering, nesting and responsive columns', async ({ page }, testInfo) => {
    const renderer = page.locator('.site-renderer')
    await expect(renderer.getByRole('heading')).toHaveText([
        'Pilot heading', 'Pilot banner', 'Pilot left', 'Pilot right', 'Pilot contact',
    ])
    await expect(renderer.locator('[data-widget-id]')).toHaveCount(6)
    const left = await renderer.locator('.two-col-slot.left').boundingBox()
    const right = await renderer.locator('.two-col-slot.right').boundingBox()
    expect(left).not.toBeNull()
    expect(right).not.toBeNull()
    if (testInfo.project.name === 'mobile') {
        expect(right.y).toBeGreaterThan(left.y)
        expect(Math.abs(right.x - left.x)).toBeLessThan(2)
    } else {
        expect(right.x).toBeGreaterThan(left.x)
        expect(left.width).toBeGreaterThan(right.width)
    }
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }))
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport)
    await expect(renderer.locator('.render-error-state,.render-empty-state')).toHaveCount(0)
    await expect(renderer.locator('script')).toHaveCount(0)
})

test('form controls work while preview submission stays inert', async ({ page }) => {
    const requests = []
    page.on('request', request => { if (request.method() === 'POST') requests.push(request.url()) })
    await page.getByRole('textbox', { name: /^Your name\s*Required$/ }).fill('Pilot person')
    await page.getByRole('combobox', { name: 'Topic' }).selectOption('Press')
    await expect(page.getByRole('textbox', { name: /^Your name\s*Required$/ })).toHaveValue('Pilot person')
    await expect(page.getByRole('combobox', { name: 'Topic' })).toHaveValue('Press')
    await page.getByRole('button', { name: 'Send pilot' }).click()
    await expect(page).toHaveURL(/pilot-baseline\.html$/)
    expect(requests).toEqual([])
})

test('unsaved preview changes do not overwrite the saved fixture', async ({ page }) => {
    await page.getByRole('button', { name: 'Show unsaved draft' }).click()
    await expect(page.getByRole('heading')).toHaveText(['Unsaved pilot heading'])
    await expect(page.getByRole('heading', { name: 'Pilot contact' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Reload saved fixture' }).click()
    await expect(page.getByRole('heading', { name: 'Pilot heading', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pilot contact' })).toBeVisible()
})
