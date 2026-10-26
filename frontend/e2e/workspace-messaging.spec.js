import { Buffer } from 'node:buffer'
import { test, expect } from '@playwright/test'

async function mockMessaging(page) {
    const tenant = '11111111-1111-1111-1111-111111111111'
    const thread = { id: 'thread-1', title: 'Ny fråga', kind: 'question', location: '', supportTarget: false, status: 'open', messages: [{ id: 'm1', senderName: 'Johan', body: 'Hej', createdAt: '2026-10-23T10:00:00Z', attachments: [] }] }
    await page.route('**/api/v1/**', async (route) => {
        const request = route.request(), path = new URL(request.url()).pathname
        let data = {}, status = 200
        if (path.includes('/current-user/')) data = { id: 1, username: 'johan', isSuperuser: true, currentWorkspace: { id: tenant, identifier: 'test', name: 'Redaktionen' }, designerTenants: [{ id: tenant, identifier: 'test', name: 'Redaktionen' }] }
        else if (path.includes('/profile-photos/')) status = request.method() === 'GET' ? 404 : 200
        else if (path.endsWith('/support/context/')) data = { tenant: { id: tenant, identifier: 'test', name: 'Redaktionen' }, userId: 1, canManage: true, canPublish: true, canSupport: true, supportAvailable: true, storageConfigured: true, videoLimits: { bug: 26214400, instruction: 209715200 }, unreadCount: 1, recipientCount: 2, recipients: [{ id: 'support', name: 'Support', kind: 'support' }, { id: 'user:2', name: 'Anna', kind: 'user' }, { id: 'board:board-1', name: 'Webbplats · Inbox', kind: 'board' }] }
        else if (path.endsWith('/support/inbox/')) data = { count: 2, results: [{ id: 'e1', threadId: 'thread-1', title: 'Granska startsidan', senderName: 'Anna', preview: 'Jag har uppdaterat rubriken.', activityAt: '2026-10-23T10:00:00Z', kind: 'question', readAt: null }, { id: 'e2', threadId: 'thread-1', title: 'Veckans planering', senderName: 'Johan', preview: 'Uppgifterna inför måndag.', activityAt: '2026-10-22T12:00:00Z', kind: 'question', readAt: '2026-10-22T12:10:00Z' }] }
        else if (path.endsWith('/support/attachments/')) data = { id: 'a1', filename: 'notes.txt', contentType: 'text/plain', byteSize: 8 }
        else if (path.endsWith('/support/threads/')) { const body = request.postDataJSON(); thread.title = body.title; thread.messages[0].body = body.body; data = thread }
        else if (path.endsWith('/support/threads/thread-1/')) data = thread
        else if (path.endsWith('/utils/roles/')) data = request.method() === 'POST' ? { id: 'r1' } : { canManage: true, canGrantAdmin: true, permissions: ['tenant.admin', 'roles.manage'], availablePermissions: ['page.read', 'page.write', 'support.read'], members: [{ id: 1, name: 'Johan', roleIds: ['r1'], permissions: ['page.read'], isSystemOwner: true }], roles: [{ id: 'r1', name: 'Redaktör', permissions: ['page.read'], users: [1] }] }
        else if (path.endsWith('/utils/users/')) data = { users: [{ id: 1, username: 'johan', isSuperuser: true }] }
        else if (path.includes('/support/instructions/')) data = { count: 0, results: [] }
        else if (path.includes('/webpages/pages/')) data = { results: [], count: 0 }
        await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.route('**/csrf-token/', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ csrfToken: 'test-csrf' }) }))
}

test('mail layout and recipient/attachment flow on messages and replies', async ({ page }, testInfo) => {
    await mockMessaging(page)
    await page.goto('/inbox')
    await expect(page.getByRole('link', { name: /Granska startsidan/ })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('inbox-desktop.png') })
    await page.getByRole('link', { name: 'Skriv meddelande' }).click()
    await expect(page.getByLabel('Typ (valfri)')).toHaveValue('question')
    await expect(page.getByLabel('Länk till platsen', { exact: true })).not.toHaveAttribute('required')
    await page.getByRole('checkbox', { name: 'Support', exact: true }).uncheck()
    await page.getByRole('checkbox', { name: 'Anna', exact: true }).check()
    await page.getByLabel('Titel', { exact: true }).fill('Ny fråga')
    await page.getByLabel('Beskrivning', { exact: true }).fill('Kan du granska sidan?')
    await page.getByLabel('Filer, bilder eller video', { exact: true }).setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Review') })
    await expect(page.getByRole('button', { name: 'Ta bort notes.txt' })).toBeVisible()
    const request = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname.endsWith('/support/threads/'))
    await page.getByRole('button', { name: 'Skicka meddelande', exact: true }).click()
    const payload = (await request).postDataJSON()
    expect(payload.recipients).toEqual(['user:2']); expect(payload.kind).toBe('question'); expect(payload.location).toBe(''); expect(payload.attachmentIds).toEqual(['a1'])
    await expect(page.getByRole('heading', { name: 'Ny fråga', exact: true })).toBeVisible()
    await page.getByLabel('Ditt svar', { exact: true }).fill('Tack')
    await page.getByLabel('Filer, bilder eller video', { exact: true }).setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Reply') })
    const reply = page.waitForRequest((r) => r.method() === 'POST' && r.url().includes('/threads/thread-1/'))
    await page.getByRole('button', { name: 'Skicka svar', exact: true }).click()
    expect((await reply).postDataJSON().attachmentIds).toEqual(['a1'])
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('navigation', { name: 'Inboxnavigation' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await page.screenshot({ path: testInfo.outputPath('message-mobile.png') })
})

test('contextual reports provide safe URL, diagnostics and the uploadable help video', async ({ page }, testInfo) => {
    await mockMessaging(page)
    await page.goto('/inbox/new?from=https%3A%2F%2Fcms.example.invalid%2Fpages%2F42%3Ftoken%3Dhidden')
    await expect(page.getByLabel('Länk till platsen', { exact: true })).toHaveValue('https://cms.example.invalid/pages/42')
    await expect(page.getByLabel(/Bifoga filtrerad diagnostik/)).toBeChecked()
    await page.getByRole('button', { name: 'Så spelar du in en femsekunders buggrapport' }).click()
    await expect(page.getByText(/Instruktionsfilmen kan laddas upp/)).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('compose-desktop.png') })
})

test('roles and profile photo upload are available in settings and Profile', async ({ page }, testInfo) => {
    await mockMessaging(page)
    await page.goto('/settings/roles')
    await expect(page.getByRole('heading', { name: /Användare och behörigheter|Users and permissions/ })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('workspace-permissions-desktop.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await page.screenshot({ path: testInfo.outputPath('workspace-permissions-mobile.png'), fullPage: true })
    await page.getByRole('button', { name: 'Settings menu' }).click()
    await expect(page.getByRole('navigation', { name: 'Settings' })).toBeVisible()
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.getByRole('button', { name: /Edit Redaktör|Redigera Redaktör/ }).click()
    await page.getByRole('checkbox', { name: /Pages · edit|Sidor · redigera/ }).check()
    const update = page.waitForRequest((r) => r.method() === 'POST' && r.url().includes('/utils/roles/'))
    await page.getByRole('button', { name: /Save role|Spara roll/ }).click()
    expect((await update).postDataJSON().permissions).toContain('page.write')
    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: /Profilbild|Profile photo/ })).toBeVisible()
    const upload = page.waitForRequest((r) => r.method() === 'PUT' && r.url().includes('/profile-photos/1/'))
    await page.getByLabel(/Ladda upp profilbild|Upload profile photo/).setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('mock-image') })
    await upload
    await expect(page.getByText(/Profilbilden har sparats|Profile photo saved/)).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('profile-desktop.png') })
})
