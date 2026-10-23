import { test, expect } from '@playwright/test'

const tenantId = '11111111-1111-1111-1111-111111111111'
const boardId = '22222222-2222-2222-2222-222222222222'
const columnId = '33333333-3333-3333-3333-333333333333'
const doneId = '44444444-4444-4444-4444-444444444444'
const cardId = '55555555-5555-5555-5555-555555555555'

async function mockWorkspace(page, { conflict = false, extraCards = [] } = {}) {
    const card = {
        id: cardId,
        shortId: 'TASK-1',
        title: 'Review homepage',
        description: '**Draft**',
        board: boardId,
        column: columnId,
        revision: 1,
        checklist: [],
        externalReferences: [],
        assignees: [],
        labels: [],
        deadline: null,
        archived: false,
        comments: [],
        activity: [],
        attachments: [],
        position: 0,
        updatedAt: new Date().toISOString(),
    }
    const allCards = [card, ...extraCards.map((extra) => ({ ...card, ...extra }))]
    const workspace = {
        tenantId,
        boards: [{ id: boardId, title: 'Website', revision: 1, archived: false }],
        columns: [
            {
                id: columnId,
                board: boardId,
                title: 'To do',
                revision: 1,
                archived: false,
            },
            {
                id: doneId,
                board: boardId,
                title: 'Done',
                revision: 1,
                archived: false,
            },
        ],
        members: [{ id: 1, name: 'Johan', username: 'johan' }],
        labels: [],
        notifications: [],
        fileTypes: { 'image/png': ['.png'], 'video/mp4': ['.mp4'] },
        fileLimits: {},
    }
    await page.routeWebSocket('**/ws/kanban/**', () => {})
    await page.route('**/api/v1/**', async (route) => {
        const request = route.request(),
            url = new URL(request.url()),
            path = url.pathname
        let data = {},
            status = 200
        if (path.includes('/current-user/'))
            data = {
                id: 1,
                username: 'johan',
                currentWorkspace: { id: tenantId, identifier: 'test' },
                designerTenants: [{ id: tenantId, identifier: 'test' }],
            }
        else if (path.endsWith('/kanban/workspace/')) data = workspace
        else if (path.endsWith('/kanban/workspace/access/')) data = { ticket: 'test-browser-ticket' }
        else if (path.endsWith(`/cards/${cardId}/comments/`)) {
            const body = request.postDataJSON()
            const comment = {
                id: 'comment',
                body: body.body,
                author: workspace.members[0],
                revision: 1,
                createdAt: new Date().toISOString(),
            }
            card.comments.push(comment)
            card.revision++
            data = comment
        } else if (path.endsWith(`/cards/${cardId}/`)) {
            if (request.method() === 'PATCH') {
                if (conflict) {
                    status = 409
                    data = { detail: 'Changed elsewhere' }
                } else {
                    const body = request.postDataJSON()
                    Object.assign(card, body, { revision: card.revision + 1 })
                    data = card
                }
            } else data = card
        } else if (path.endsWith('/kanban/cards/')) {
            let results = allCards
            if (
                url.searchParams.get('q') &&
                !card.title.toLowerCase().includes(url.searchParams.get('q').toLowerCase())
            )
                results = []
            data = { results, semanticAvailable: false }
        } else if (path.includes('/webpages/pages/')) data = []
        await route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify(data),
        })
    })
    await page.route('**/csrf-token/', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ csrfToken: 'test-csrf' }),
        }),
    )
    return { card, workspace }
}

test('board navigation, accessible movement, Markdown and comments', async ({ page }, testInfo) => {
    await mockWorkspace(page)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`/kanban/boards/${boardId}`)
    await expect(page.getByRole('link', { name: 'Review homepage', exact: true })).toBeVisible()
    await page.getByLabel('Kortåtgärder för TASK-1', { exact: true }).click()
    await page.getByRole('combobox', { name: 'Flytta TASK-1 till' }).selectOption(doneId)
    await expect(
        page
            .getByRole('heading', { name: 'Done', exact: true })
            .locator('..')
            .locator('..')
            .getByRole('link', { name: 'Review homepage' }),
    ).toBeVisible()
    await page.screenshot({
        path: testInfo.outputPath('board-desktop.png'),
        fullPage: true,
    })
    await page.getByRole('link', { name: 'Review homepage', exact: true }).click()
    await page.getByRole('button', { name: 'Markdown', exact: true }).first().click()
    await page.getByRole('textbox', { name: 'Beskrivning', exact: true }).fill('# Approved\n\n**Ready**')
    await page.getByRole('button', { name: 'Spara kort', exact: true }).click()
    await page.getByRole('button', { name: 'Visuellt', exact: true }).first().click()
    await expect(page.locator('[contenteditable=true]').first()).toContainText('Approved')
    await page.getByRole('button', { name: 'Markdown', exact: true }).last().click()
    await page.getByRole('textbox', { name: 'Ny kommentar', exact: true }).fill('Reviewed **today**')
    await page.getByRole('button', { name: 'Kommentera', exact: true }).click()
    await expect(page.getByRole('complementary', { name: 'Kommentarer och aktivitet' })).toContainText('Reviewed today')
    await page.screenshot({
        path: testInfo.outputPath('detail-desktop.png'),
        fullPage: true,
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('button', { name: 'Spara kort', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await page.screenshot({
        path: testInfo.outputPath('detail-mobile.png'),
        fullPage: true,
    })
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await page.screenshot({
        path: testInfo.outputPath('detail-mobile-dark.png'),
        fullPage: true,
    })
    expect(errors).toEqual([])
})

test('a conflicting save keeps the local draft', async ({ page }) => {
    await mockWorkspace(page, { conflict: true })
    await page.goto(`/kanban/cards/${cardId}`)
    await page.getByRole('textbox', { name: 'Rubrik', exact: true }).fill('My unsaved title')
    await page.getByRole('button', { name: 'Spara kort', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Någon har ändrat')
    await expect(page.getByRole('textbox', { name: 'Rubrik', exact: true })).toHaveValue('My unsaved title')
})

test('movement in a filtered column uses persisted card positions', async ({ page }) => {
    await mockWorkspace(page, {
        extraCards: [
            { id: '66666666-6666-6666-6666-666666666666', shortId: 'TASK-6', title: 'Later visible card', position: 5 },
        ],
    })
    await page.goto(`/kanban/boards/${boardId}`)
    const request = page.waitForRequest(
        (request) => request.method() === 'PATCH' && request.url().includes(`/cards/${cardId}/`),
    )
    await page.getByLabel('Kortåtgärder för TASK-1', { exact: true }).click()
    await page.getByRole('button', { name: 'Flytta TASK-1 ned', exact: true }).click()
    expect((await request).postDataJSON().position).toBe(5)
})

test('dropping before a later card adjusts for removal of the source card', async ({ page }) => {
    await mockWorkspace(page, {
        extraCards: [
            { id: '66666666-6666-6666-6666-666666666666', shortId: 'TASK-6', title: 'Later visible card', position: 5 },
        ],
    })
    await page.goto(`/kanban/boards/${boardId}`)
    const source = page
        .locator('article')
        .filter({ has: page.getByRole('link', { name: 'Review homepage', exact: true }) })
    const destination = page
        .locator('article')
        .filter({ has: page.getByRole('link', { name: 'Later visible card', exact: true }) })
    const request = page.waitForRequest(
        (request) => request.method() === 'PATCH' && request.url().includes(`/cards/${cardId}/`),
    )
    await source.dragTo(destination)
    expect((await request).postDataJSON().position).toBe(4)
})

test('visual typing preserves caret order and paragraph breaks across Markdown mode', async ({ page }) => {
    const { card } = await mockWorkspace(page)
    card.description = ''
    await page.goto(`/kanban/cards/${cardId}`)
    const visual = page.locator('[contenteditable=true]').first()
    await visual.click()
    await visual.pressSequentially('ABC', { delay: 150 })
    await expect(visual).toHaveText('ABC')
    await visual.press('Enter')
    await visual.pressSequentially('DEF', { delay: 150 })
    await expect(visual).toHaveText('ABCDEF')
    await page.getByRole('button', { name: 'Markdown', exact: true }).first().click()
    await expect(page.getByRole('textbox', { name: 'Beskrivning', exact: true })).toHaveValue('ABC\n\nDEF')
    await page.getByRole('button', { name: 'Visuellt', exact: true }).first().click()
    await expect(page.locator('[contenteditable=true]').first()).toHaveText('ABC\nDEF')
})

test('board overview and compact board keep creation separate at narrow widths', async ({ page }, testInfo) => {
    await mockWorkspace(page)
    await page.goto('/kanban')
    await expect(page.getByRole('link', { name: 'Website', exact: true })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Tavelnamn' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Skapa tavla' }).click()
    await expect(page.getByRole('textbox', { name: 'Tavelnamn' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('overview-desktop.png') })
    await page.getByRole('link', { name: 'Website', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Tavelnamn' })).toHaveCount(0)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('button', { name: 'Lägg till kort' }).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await page.screenshot({ path: testInfo.outputPath('board-mobile.png') })
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('.user-tools-shell')).toHaveCSS('color-scheme', 'light')
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.getByRole('navigation', { name: 'Personliga verktyg' }).getByRole('link', { name: 'Profile', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('profile-desktop.png') })
    await expect(page.getByRole('navigation', { name: 'Personliga verktyg' }).getByRole('link', { name: 'Profile', exact: true })).toHaveAttribute('aria-current', 'page')
})
