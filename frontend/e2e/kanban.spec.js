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
        boards: [{ id: boardId, title: 'Website', revision: 1, archived: false, members: [1], hasBackground: false }],
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
        labels: [{ id: '99999999-9999-9999-9999-999999999999', name: 'Priority' }],
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
        if (path.includes('/profile-photos/')) {
            await route.fulfill({ status: 404, body: '' })
            return
        }
        if (path.includes('/current-user/'))
            data = {
                id: 1,
                username: 'johan',
                currentWorkspace: { id: tenantId, identifier: 'test' },
                designerTenants: [{ id: tenantId, identifier: 'test' }],
            }
        else if (path.endsWith('/kanban/workspace/')) data = workspace
        else if (path.endsWith('/kanban/workspace/access/')) data = { ticket: 'test-browser-ticket' }
        else if (path.endsWith(`/boards/${boardId}/available-members/`)) data = [...workspace.members, { id: 2, name: 'Alex', username: 'alex' }]
        else if (path.endsWith(`/boards/${boardId}/members/`)) {
            workspace.boards[0].members = request.postDataJSON().members
            workspace.boards[0].revision++
            data = workspace.boards[0]
        } else if (path.endsWith(`/boards/${boardId}/`) && request.method() === 'PATCH') {
            workspace.boards[0].title = request.postDataJSON().title
            workspace.boards[0].revision++
            data = workspace.boards[0]
        }
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

test('board menu opens member and edit dialogs without breaking the toolbar', async ({ page }) => {
    await mockWorkspace(page)
    await page.goto(`/kanban/boards/${boardId}`)
    await expect(page.getByRole('heading', { name: 'Website' })).toBeVisible()
    await page.getByRole('button', { name: 'Tavelåtgärder' }).click()
    await page.getByRole('button', { name: 'Medlemmar', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('textbox', { name: 'Sök användare' }).fill('Alex')
    await page.getByRole('checkbox', { name: 'Alex' }).check()
    await expect(page.getByRole('checkbox', { name: 'Alex' })).toBeChecked()
    await page.getByRole('button', { name: 'Stäng dialog' }).click()
    await page.getByRole('button', { name: 'Tavelåtgärder' }).click()
    await page.getByRole('button', { name: 'Redigera tavlan' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('textbox', { name: 'Tavelnamn' }).fill('New website')
    await page.getByRole('button', { name: 'Spara', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'New website' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
})

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
    await page.getByRole('button', { name: 'Redigera beskrivning' }).click()
    await page.getByRole('button', { name: 'Markdown', exact: true }).first().click()
    await page.getByRole('textbox', { name: 'Beskrivning', exact: true }).fill('# Approved\n\n**Ready**')
    await page.getByRole('button', { name: 'Spara', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('Approved')
    await page.getByRole('button', { name: 'Skriv en kommentar…' }).click()
    await page.getByRole('button', { name: 'Markdown', exact: true }).last().click()
    await page.getByRole('textbox', { name: 'Ny kommentar', exact: true }).fill('Reviewed **today**')
    await page.getByRole('button', { name: 'Kommentera', exact: true }).click()
    await expect(page.getByRole('complementary', { name: 'Kommentarer och aktivitet' })).toContainText('Reviewed today')
    await page.screenshot({
        path: testInfo.outputPath('detail-desktop.png'),
        fullPage: true,
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('button', { name: 'Redigera beskrivning' })).toBeVisible()
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
    await page.getByRole('button', { name: 'Redigera beskrivning' }).click()
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


test('quick card actions save members, labels, cover and deadline without opening details', async ({ page }, testInfo) => {
    const { card } = await mockWorkspace(page)
    await page.goto(`/kanban/boards/${boardId}`)
    const open = async (action) => {
        await page.getByLabel('Kortåtgärder för TASK-1', { exact: true }).click()
        await page.getByRole('button', { name: action, exact: true }).click()
    }
    await open('Ändra medlemmar')
    await page.getByRole('checkbox', { name: 'Johan' }).check()
    await page.getByRole('button', { name: 'Spara', exact: true }).click()
    await expect.poll(() => card.assignees).toEqual([1])
    await open('Ändra etiketter')
    await page.getByRole('checkbox', { name: 'Priority' }).check()
    await page.getByRole('button', { name: 'Spara', exact: true }).click()
    await expect.poll(() => card.labels).toEqual(['99999999-9999-9999-9999-999999999999'])
    await open('Byt omslag')
    await page.getByRole('radio', { name: 'green', exact: true }).check()
    await page.getByRole('button', { name: 'Spara', exact: true }).click()
    await expect(page.locator('.kb-card-cover')).toHaveCSS('background-color', 'rgb(21, 128, 61)')
    await open('Redigera datum')
    await page.getByLabel('Deadline', { exact: true }).fill('2026-11-10T12:00')
    await page.getByRole('button', { name: 'Spara', exact: true }).click()
    await expect.poll(() => !!card.deadline).toBe(true)
    await page.getByLabel('Kortåtgärder för TASK-1', { exact: true }).click()
    await expect(page.getByRole('button', { name: 'Spegla', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Kopiera kort', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Jira/ })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('card-actions.png') })
    await page.keyboard.press('Escape')
    await expect(page.getByLabel('Kortåtgärder för TASK-1', { exact: true })).toBeFocused()
    await page.getByLabel('Liståtgärder för To do', { exact: true }).click()
    await expect(page.getByRole('button', { name: 'Kopiera lista', exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('column-actions.png') })
})

test('card-sized insertion feedback and whole-column ghosts support edge autoscroll', async ({ page }, testInfo) => {
    const { workspace } = await mockWorkspace(page, { extraCards: Array.from({ length: 16 }, (_, index) => ({ id: `extra-${index}`, shortId: `TASK-${index + 2}`, title: `Card ${index + 2}`, position: index + 1 })) })
    workspace.columns.push(...Array.from({ length: 6 }, (_, index) => ({ id: `column-${index}`, board: boardId, title: `List ${index}`, revision: 1, archived: false })))
    await page.goto(`/kanban/boards/${boardId}`)
    const card = page.locator('.kb-card').first()
    const height = (await card.boundingBox()).height
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
    await card.dispatchEvent('dragstart', { dataTransfer })
    const second = await page.locator('.kb-card').nth(1).boundingBox()
    await page.locator('.kb-lists').dispatchEvent('dragover', { dataTransfer, clientX: second.x + 20, clientY: second.y + 10 })
    await expect(page.locator('.kb-card-landing')).toBeVisible()
    expect((await page.locator('.kb-card-landing').boundingBox()).height).toBe(height)
    await page.screenshot({ path: testInfo.outputPath('card-drag.png') })
    const board = await page.locator('.kb-lists').boundingBox()
    await page.locator('.kb-lists').dispatchEvent('dragover', { dataTransfer, clientX: second.x + 20, clientY: board.y + board.height - 10 })
    await expect.poll(() => page.locator('.kb-column').first().evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    await page.locator('.kb-lists').dispatchEvent('dragover', { dataTransfer, clientX: board.x + board.width - 8, clientY: board.y + 80 })
    await expect.poll(() => page.locator('.kb-lists').evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
    await card.dispatchEvent('dragend', { dataTransfer })
    await page.locator('.kb-lists').evaluate((element) => { element.scrollLeft = 0 })
    await page.locator('.kb-column').first().evaluate((element) => { element.scrollTop = 0 })
    await page.locator('.kb-column > header').first().dispatchEvent('dragstart', { dataTransfer })
    await expect(page.locator('.kb-drag-ghost .kb-card')).toHaveCount(17)
    const destination = await page.locator('.kb-column').nth(1).boundingBox()
    await page.locator('.kb-lists').dispatchEvent('dragover', { dataTransfer, clientX: destination.x + 10, clientY: destination.y + 30 })
    await expect(page.locator('.kb-column-landing')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('column-drag.png') })
    await page.locator('.kb-column > header').first().dispatchEvent('dragend', { dataTransfer })
    await expect(page.locator('.kb-column-landing')).toHaveCount(0)
    await expect(page.locator('.kb-drag-ghost')).toHaveCount(0)
})

test('copy and mirror choose a destination, and links copy to the clipboard', async ({ page, context }) => {
    await mockWorkspace(page)
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto(`/kanban/boards/${boardId}`)
    for (const [action, mirror] of [['Kopiera kort', false], ['Spegla', true]]) {
        await page.getByLabel('Kortåtgärder för TASK-1', { exact: true }).click()
        await page.getByRole('button', { name: action, exact: true }).click()
        await page.getByLabel('Till lista', { exact: true }).selectOption(doneId)
        const request = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith(`/cards/${cardId}/duplicate/`))
        await page.getByRole('button', { name: 'Spara', exact: true }).click()
        expect((await request).postDataJSON()).toEqual({ revision: 1, column: doneId, mirror })
        await expect(page.getByRole('button', { name: 'Spara', exact: true })).toHaveCount(0)
    }
    await page.getByLabel('Kortåtgärder för TASK-1', { exact: true }).click()
    await page.getByRole('button', { name: 'Kopiera länk', exact: true }).click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${new URL(page.url()).origin}/kanban/cards/${cardId}`)
    await page.getByLabel('Liståtgärder för To do', { exact: true }).click()
    const request = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith(`/columns/${columnId}/duplicate/`))
    await page.getByRole('button', { name: 'Kopiera lista', exact: true }).click()
    expect((await request).postDataJSON()).toEqual({ revision: 1 })
})


test('card detail opens over its board, protects drafts and returns focus on close', async ({ page }, testInfo) => {
    const { card } = await mockWorkspace(page)
    card.description = '## A clear content taxonomy\n\nOne shared register for pages, objects and media.\n\n- Shared labels\n- A consistent hierarchy'
    card.assignees = [1]
    card.activity = [{ id: 'created', actor: { id: 1, name: 'Johan' }, message: 'Johan lade till det här kortet i To do.', createdAt: '2026-10-25T12:00:00Z', canUndo: false }]
    await page.goto(`/kanban/boards/${boardId}`)
    await page.getByRole('link', { name: 'Review homepage', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Review homepage' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'A clear content taxonomy' })).toBeVisible()
    await expect(dialog.getByLabel('Flytta till', { exact: true })).toHaveValue(columnId)
    await expect(dialog.getByRole('button', { name: 'Markdown', exact: true })).toHaveCount(0)
    await expect(dialog.getByRole('textbox', { name: 'Deadline' })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('card-detail-overlay.png') })
    await dialog.getByRole('textbox', { name: 'Rubrik' }).fill('Unsaved title')
    await dialog.getByRole('button', { name: 'Stäng kort' }).click()
    await expect(dialog.getByRole('status')).toContainText('osparade ändringar')
    await dialog.getByRole('button', { name: 'Fortsätt redigera' }).click()
    await dialog.getByRole('button', { name: 'Spara kort', exact: true }).click()
    await expect.poll(() => card.title).toBe('Unsaved title')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp(`/kanban/boards/${boardId}$`))
    await expect(page.getByRole('link', { name: 'Unsaved title', exact: true })).toBeFocused()
    await page.getByRole('link', { name: 'Unsaved title', exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await expect(page.getByRole('dialog')).toHaveCSS('color-scheme', 'light')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await page.screenshot({ path: testInfo.outputPath('card-detail-overlay-mobile.png') })
    await page.getByRole('button', { name: 'Stäng kort' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('detail toolbar edits dates, labels and checklist, and reveals attachments', async ({ page }) => {
    const { card } = await mockWorkspace(page)
    await page.goto(`/kanban/cards/${cardId}`)
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Datum', exact: true }).click()
    await dialog.getByLabel('Deadline', { exact: true }).fill('2026-11-10T12:00')
    await dialog.getByRole('button', { name: 'Spara kort', exact: true }).click()
    await expect.poll(() => !!card.deadline).toBe(true)
    await dialog.getByRole('button', { name: 'Etiketter', exact: true }).click()
    await dialog.getByRole('checkbox', { name: 'Priority', exact: true }).check()
    await dialog.getByRole('button', { name: 'Spara kort', exact: true }).click()
    await expect.poll(() => card.labels).toEqual(['99999999-9999-9999-9999-999999999999'])
    await dialog.getByRole('button', { name: 'Checklista', exact: true }).click()
    await dialog.getByLabel('Ny checklistpunkt', { exact: true }).fill('Review the detail')
    await dialog.getByRole('button', { name: 'Lägg till punkt', exact: true }).click()
    await dialog.getByRole('button', { name: 'Spara kort', exact: true }).click()
    await expect.poll(() => card.checklist.length).toBe(1)
    await dialog.getByRole('button', { name: 'Bilaga', exact: true }).click()
    await expect(dialog.locator('input[type=file]')).toBeVisible()
    await dialog.getByLabel('Kortåtgärder för TASK-1', { exact: true }).click()
    await page.getByRole('button', { name: 'Byt omslag', exact: true }).click()
    await page.getByRole('radio', { name: 'green', exact: true }).check()
    await page.getByRole('button', { name: 'Spara', exact: true }).click()
    await expect(dialog.locator('.kb-detail-cover')).toHaveCSS('background-color', 'rgb(21, 128, 61)')
    await expect(dialog.getByText('Kortet har uppdaterats.', { exact: false })).toHaveCount(0)
})


test('description editor has one toolbar frame, formatting help and local save/cancel actions', async ({ page }, testInfo) => {
    const { card } = await mockWorkspace(page)
    card.description = 'A plain paragraph'
    await page.goto(`/kanban/cards/${cardId}`)
    await page.getByRole('button', { name: 'Redigera beskrivning' }).click()
    const editor = page.locator('.kb-detail-description [contenteditable=true]')
    await editor.fill('A formatted paragraph')
    await editor.press('ControlOrMeta+a')
    expect(await editor.evaluate(() => window.getSelection().toString())).toBe('A formatted paragraph')
    await page.getByRole('button', { name: 'Bold', exact: true }).click()
    await expect(editor.locator('b, strong')).toHaveText('A formatted paragraph')
    await page.getByRole('button', { name: 'Formateringshjälp', exact: true }).click()
    await expect(page.locator('.kb-editor-help')).toContainText('Ctrl+B')
    await page.getByRole('button', { name: 'Formateringshjälp', exact: true }).click()
    await editor.click()
    await expect(page.locator('.kb-detail-description .kb-editor-frame')).toHaveCSS('border-top-color', 'rgb(37, 99, 235)')
    await page.screenshot({ path: testInfo.outputPath('kanban-description-editor.png') })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await page.screenshot({ path: testInfo.outputPath('kanban-description-editor-mobile.png') })
    await page.getByRole('button', { name: 'Spara', exact: true }).click()
    await expect.poll(() => card.description).toContain('**A formatted paragraph**')
    await page.getByRole('button', { name: 'Redigera beskrivning' }).click()
    await page.getByRole('textbox', { name: 'Rubrik', exact: true }).fill('Keep this title draft')
    await editor.fill('Discard this description')
    await page.getByRole('button', { name: 'Avbryt', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Rubrik', exact: true })).toHaveValue('Keep this title draft')
    await expect(page.locator('.kb-detail-description')).toContainText('A formatted paragraph')
    await expect(page.locator('.kb-detail-description')).not.toContainText('Discard this description')
    await expect(page.getByRole('button', { name: 'Spara kort', exact: true })).toBeVisible()
})
