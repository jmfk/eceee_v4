import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InboxPage from '../InboxPage'
import SupportSettingsPage from '../SupportSettingsPage'
import { supportRequest, validateBugVideo } from '../../api/support'
import { setCmsCopyLanguage } from '../../utils/cmsCopy'

vi.unmock('react-router-dom')

vi.mock('../../components/StatusBar', () => ({
    default: () => <footer aria-label="Status">Inbox</footer>,
}))
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 42, username: 'anna' } }),
}))
vi.mock('../../api/support', async (importOriginal) => ({
    ...(await importOriginal()),
    supportRequest: vi.fn(),
    validateBugVideo: vi.fn(),
}))

const context = {
    userId: 42,
    tenant: { name: 'Tenant A', identifier: 'a' },
    canPublish: true,
    canSupport: false,
    canManage: false,
    unreadCount: 1,
    recipientCount: 2,
    supportAvailable: true,
    messageLabels: [
        { id: 'label-question', name: 'Question', key: 'question' },
        { id: 'label-suggestion', name: 'Suggestion', key: 'suggestion' },
        { id: 'label-content', name: 'Content', key: 'content' },
        { id: 'label-bug', name: 'Bug Report', key: 'bug' },
    ],
    videoLimits: { bug: 26214400, instruction: 209715200 },
}
const thread = {
    id: 'thread-1',
    title: 'Rubriken sparas inte',
    kind: 'bug',
    location: 'https://cms.example.invalid/pages/4',
    status: 'open',
    messages: [
        {
            id: 'm1',
            senderName: 'Anna',
            body: 'Rubriken försvinner.',
            createdAt: '2026-10-22T12:00:00Z',
        },
    ],
}
const renderInbox = (route = '/inbox/?tenant=a') => {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[route]}>
                <Routes>
                    <Route path="/inbox/*" element={<InboxPage />} />
                    <Route path="/settings/support" element={<SupportSettingsPage />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    setCmsCopyLanguage('sv-se')
    vi.clearAllMocks()
    supportRequest.mockImplementation(async (_tenant, path, method) => {
        if (path === 'context/') return context
        if (path.startsWith('inbox/?'))
            return {
                results: [
                    {
                        id: 'entry-1',
                        threadId: 'thread-1',
                        title: thread.title,
                        kind: 'bug',
                        activityAt: '2026-10-22T12:00:00Z',
                        readAt: null,
                    },
                ],
                count: 1,
            }
        if (path === 'threads/' && method === 'post') return thread
        if (path === 'threads/thread-1/') return thread
        if (path.startsWith('instructions/?')) return { results: [], count: 0 }
        throw new Error(`Unexpected ${path}`)
    })
})

describe('tenant inbox journey', () => {
    it('keeps support configuration in Settings and redirects the old Inbox link', async () => {
        supportRequest.mockImplementation(async (_tenant, path) => {
            if (path === 'context/') return { ...context, canManage: true, members: [], roles: [] }
            if (path === 'deliveries/') return { results: [] }
            throw new Error(`Unexpected ${path}`)
        })
        renderInbox('/inbox/manage?tenant=a')
        expect(await screen.findByRole('heading', { name: 'Supportinställningar' })).toBeInTheDocument()
        expect(screen.queryByRole('navigation', { name: 'Inboxnavigation' })).not.toBeInTheDocument()
    })

    it('adds several message labels instead of choosing one type', async () => {
        renderInbox('/inbox/new?tenant=a')
        await screen.findByRole('heading', { name: 'Nytt meddelande' })
        expect(screen.queryByLabelText('Typ (valfri)')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Ta bort etiketten Question' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Lägg till etikett' }))
        fireEvent.click(screen.getByRole('checkbox', { name: 'Suggestion' }))
        fireEvent.click(screen.getByRole('checkbox', { name: 'Bug Report' }))
        fireEvent.click(screen.getByRole('button', { name: 'Ta bort etiketten Question' }))
        fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Idé' } })
        fireEvent.change(screen.getByLabelText('Beskrivning'), { target: { value: 'Förslag' } })
        fireEvent.click(screen.getByRole('button', { name: 'Skicka meddelande' }))
        await waitFor(() => expect(supportRequest).toHaveBeenCalledWith('a', 'threads/', 'post', expect.objectContaining({
            labelIds: ['label-suggestion', 'label-bug'],
        })))
    })

    it('lets a workspace manager edit message labels in Support settings', async () => {
        const labels = context.messageLabels.map((label) => ({ ...label }))
        supportRequest.mockImplementation(async (_tenant, path, method, data) => {
            if (path === 'context/') return { ...context, canManage: true, members: [], roles: [], messageLabels: [...labels] }
            if (path === 'labels/' && method === 'post') {
                const label = { id: 'label-new', name: data.name, key: '' }
                labels.push(label)
                return label
            }
            if (path === 'labels/label-question/' && method === 'patch') {
                labels[0] = { ...labels[0], name: data.name }
                return labels[0]
            }
            if (path === 'labels/label-new/' && method === 'delete') {
                labels.splice(labels.findIndex((label) => label.id === 'label-new'), 1)
                return null
            }
            throw new Error(`Unexpected ${path}`)
        })
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
        try {
            renderInbox('/settings/support?tenant=a')
            await screen.findByRole('heading', { name: 'Supportinställningar' })
            expect(screen.getByRole('link', { name: 'Hantera arbetsytans roller och behörigheter' })).toHaveAttribute('href', '/settings/roles?tenant=a')
            fireEvent.click(screen.getAllByRole('button', { name: 'Byt namn' })[0])
            fireEvent.change(screen.getByRole('textbox', { name: 'Nytt namn för Question' }), { target: { value: 'General question' } })
            fireEvent.click(screen.getByRole('button', { name: 'Spara' }))
            await waitFor(() => expect(supportRequest).toHaveBeenCalledWith('a', 'labels/label-question/', 'patch', { name: 'General question' }))

            fireEvent.change(screen.getByRole('textbox', { name: 'Ny etikett' }), { target: { value: 'Priority' } })
            fireEvent.click(screen.getByRole('button', { name: 'Lägg till etikett' }))
            await screen.findByText('Priority')
            fireEvent.click(screen.getAllByRole('button', { name: 'Ta bort' }).at(-1))
            await waitFor(() => expect(supportRequest).toHaveBeenCalledWith('a', 'labels/label-new/', 'delete'))
        } finally {
            confirm.mockRestore()
        }
    })

    it('adds multiple existing users and roles from the To picker and sends the selection', async () => {
        const original = supportRequest.getMockImplementation()
        const directory = [
            { id: 'support', name: 'Support', kind: 'support' },
            { id: 'user:12', name: 'Dev User', kind: 'user' },
            { id: 'role:8', name: 'Redaktör', kind: 'group' },
        ]
        supportRequest.mockImplementation(async (tenant, path, method, data) =>
            path === 'context/' ? { ...context, recipients: directory } : original(tenant, path, method, data),
        )
        renderInbox('/inbox/new?tenant=a')
        await screen.findByRole('heading', { name: 'Nytt meddelande' })
        expect(screen.getByRole('button', { name: 'Ta bort Support' })).toBeInTheDocument()
        expect(screen.queryByRole('checkbox', { name: 'Dev User' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Lägg till' }))
        fireEvent.change(screen.getByRole('searchbox', { name: 'Sök mottagare' }), { target: { value: 'Dev' } })
        fireEvent.click(screen.getByRole('checkbox', { name: 'Dev User' }))
        fireEvent.change(screen.getByRole('searchbox', { name: 'Sök mottagare' }), { target: { value: 'Red' } })
        fireEvent.click(screen.getByRole('checkbox', { name: 'Redaktör' }))
        expect(screen.getByRole('button', { name: 'Ta bort Dev User' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Ta bort Redaktör' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Ta bort Support' }))

        fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Fråga' } })
        fireEvent.change(screen.getByLabelText('Beskrivning'), { target: { value: 'Behöver hjälp' } })
        fireEvent.click(screen.getByRole('button', { name: 'Skicka meddelande' }))
        await waitFor(() => expect(supportRequest).toHaveBeenCalledWith('a', 'threads/', 'post', expect.objectContaining({
            recipients: ['user:12', 'role:8'],
        })))
    })

    it('shows an English sender fallback in English mode', async () => {
        setCmsCopyLanguage('en-us')
        renderInbox()
        expect(await screen.findByText('Message')).toBeInTheDocument()
    })

    it('marks Inbox as selected on a direct URL without a trailing slash', async () => {
        renderInbox('/inbox?tenant=a')
        await screen.findByRole('heading', { name: 'Din inbox' })
        expect(screen.getByRole('navigation', { name: 'Personliga verktyg' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Till CMS' })).toHaveAttribute('href', '/pages')
        expect(screen.getByRole('link', { name: 'Inbox (1 olästa)' })).toHaveAttribute('aria-current', 'page')
    })

    it('preselects a help article when publishing from its documentation page', async () => {
        renderInbox('/inbox/publish?tenant=a&guide=pages-create&lang=en')
        await screen.findByRole('heading', { name: 'Publicera instruktion' })
        expect(screen.getByRole('combobox', { name: /Koppla till hjälpartikel/ })).toHaveValue('pages-create')
        expect(screen.getByRole('combobox', { name: 'Instruktionens språk' })).toHaveValue('en')
        fireEvent.change(screen.getByRole('combobox', { name: 'Instruktionens språk' }), {
            target: { value: 'sv' },
        })
        expect(screen.getByRole('combobox', { name: 'Instruktionens språk' })).toHaveValue('sv')
    })

    it('requires an explicit new submission after an edited retry conflicts', async () => {
        const original = supportRequest.getMockImplementation()
        const submissions = []
        supportRequest.mockImplementation(
            async (tenant, path, method, data) => {
                if (path === 'threads/' && method === 'post') {
                    submissions.push(data)
                    if (submissions.length === 1)
                        throw {
                            response: {
                                status: 409,
                                data: {
                                    detail: 'En tidigare sändning finns.',
                                    existingId: 'thread-1',
                                },
                            },
                        }
                    return thread
                }
                return original(tenant, path, method, data)
            },
        )
        renderInbox('/inbox/new?tenant=a')
        await screen.findByRole('heading', {
            name: 'Nytt meddelande',
        })
        fireEvent.change(screen.getByLabelText('Titel'), {
            target: { value: 'Fråga' },
        })
        fireEvent.change(screen.getByLabelText('Beskrivning'), {
            target: { value: 'Min ändrade text' },
        })
        fireEvent.click(
            screen.getByRole('button', { name: 'Skicka meddelande' }),
        )
        await screen.findByRole('alert')
        expect(screen.getByLabelText('Beskrivning')).toHaveValue(
            'Min ändrade text',
        )
        expect(
            screen.getByRole('link', { name: /Öppna den sparade/ }),
        ).toHaveAttribute('href', '/inbox/threads/thread-1?tenant=a')
        fireEvent.click(
            screen.getByRole('button', { name: 'Skicka som nytt ärende' }),
        )
        await screen.findByRole('heading', { name: thread.title })
        expect(submissions[1].requestId).not.toBe(submissions[0].requestId)
        expect(submissions[1].body).toBe('Min ändrade text')
    })

    it('does not redirect away when a submission completes after leaving the form', async () => {
        let finish
        supportRequest.mockImplementation(async (_tenant, path, method) => {
            if (path === 'context/') return context
            if (path.startsWith('instructions/?'))
                return { results: [], count: 0 }
            if (path === 'threads/' && method === 'post')
                return new Promise((resolve) => {
                    finish = resolve
                })
            if (path === 'threads/thread-1/') return thread
            throw new Error(`Unexpected ${path}`)
        })
        renderInbox('/inbox/new?tenant=a')
        await screen.findByRole('heading', {
            name: 'Nytt meddelande',
        })
        fireEvent.change(screen.getByLabelText('Titel'), {
            target: { value: 'Fråga' },
        })
        fireEvent.change(screen.getByLabelText('Beskrivning'), {
            target: { value: 'Behöver hjälp' },
        })
        fireEvent.click(
            screen.getByRole('button', { name: 'Skicka meddelande' }),
        )
        await waitFor(() => expect(finish).toBeTypeOf('function'))
        fireEvent.click(
            screen.getByRole('link', { name: 'Instruktionsfilmer' }),
        )
        await screen.findByRole('heading', { name: 'Instruktionsfilmer' })
        await act(async () => finish(thread))
        expect(
            screen.getByRole('heading', { name: 'Instruktionsfilmer' }),
        ).toBeInTheDocument()
    })

    it('keeps tabs visible on the report form, captures a safe location, and creates a text report', async () => {
        renderInbox(
            '/inbox/new?tenant=a&from=https%3A%2F%2Fcms.example.invalid%2Fpages%2F4%3Ftoken%3Dhidden%23secret',
        )
        await screen.findByRole('heading', {
            name: 'Nytt meddelande',
        })
        expect(
            screen.getByRole('navigation', { name: 'Inboxnavigation' }),
        ).toBeInTheDocument()
        expect(
            screen.queryByRole('button', { name: 'Till inbox' }),
        ).not.toBeInTheDocument()
        expect(screen.getByLabelText('Länk till platsen')).toHaveValue(
            'https://cms.example.invalid/pages/4',
        )
        expect(screen.getByRole('link', { name: /Så spelar du in en femsekunders buggrapport/ })).toHaveAttribute(
            'href', '/help/how-to/record-bug-video?tenant=a',
        )
        expect(screen.getByRole('link', { name: /Så spelar du in en femsekunders buggrapport/ })).toHaveAttribute(
            'target', '_blank',
        )
        fireEvent.change(screen.getByLabelText('Titel'), {
            target: { value: thread.title },
        })
        fireEvent.change(screen.getByLabelText('Beskrivning'), {
            target: { value: 'Rubriken försvinner.' },
        })
        fireEvent.click(
            screen.getByRole('button', { name: 'Skicka meddelande' }),
        )
        await screen.findByRole('heading', { name: thread.title })
        expect(supportRequest).toHaveBeenCalledWith(
            'a',
            'threads/',
            'post',
            expect.objectContaining({
                labelIds: ['label-question'],
                videoId: null,
                requestId: expect.any(String),
                location: 'https://cms.example.invalid/pages/4',
            }),
        )
    })

    it('preserves tenant selection when navigating from an email deep link and replying', async () => {
        renderInbox('/inbox/threads/thread-1?tenant=a')
        await screen.findByRole('heading', { name: thread.title })
        fireEvent.change(screen.getByLabelText('Ditt svar'), {
            target: { value: 'Nu fungerar det.' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Skicka svar' }))
        await waitFor(() =>
            expect(supportRequest).toHaveBeenCalledWith(
                'a',
                'threads/thread-1/',
                'post',
                expect.objectContaining({ body: 'Nu fungerar det.' }),
            ),
        )
        expect(
            screen.getByRole('link', { name: /Instruktionsfilmer/ }),
        ).toHaveAttribute('href', '/inbox/library?tenant=a')
        expect(
            screen.queryByRole('button', { name: 'Till inbox' }),
        ).not.toBeInTheDocument()
    })

    it('retains the composed description when submission fails', async () => {
        supportRequest.mockImplementation(async (_tenant, path) => {
            if (path === 'context/') return context
            throw new Error('offline')
        })
        renderInbox('/inbox/new?tenant=a')
        await screen.findByRole('heading', {
            name: 'Nytt meddelande',
        })
        fireEvent.change(screen.getByLabelText('Titel'), {
            target: { value: 'Ett fel' },
        })
        fireEvent.change(screen.getByLabelText('Beskrivning'), {
            target: { value: 'Min text finns kvar.' },
        })
        fireEvent.change(screen.getByLabelText('Länk till platsen'), {
            target: { value: 'https://cms.example.invalid/pages/4' },
        })
        fireEvent.click(
            screen.getByRole('button', { name: 'Skicka meddelande' }),
        )
        await screen.findByRole('alert')
        expect(screen.getByLabelText('Beskrivning')).toHaveValue(
            'Min text finns kvar.',
        )
    })
    it('waits for video validation before sending a message', async () => {
        let finishValidation
        validateBugVideo.mockImplementation(() => new Promise((resolve) => { finishValidation = resolve }))
        renderInbox('/inbox/new?tenant=a')
        await screen.findByRole('heading', { name: 'Nytt meddelande' })
        fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Video report' } })
        fireEvent.change(screen.getByLabelText('Beskrivning'), { target: { value: 'See attached video' } })
        fireEvent.change(screen.getByLabelText('Filer, bilder eller video'), { target: { files: [new File(['clip'], 'clip.mp4', { type: 'video/mp4' })] } })
        expect(screen.getByRole('button', { name: 'Skicka meddelande' })).toBeDisabled()
        await act(async () => finishValidation())
        expect(screen.getByRole('button', { name: 'Skicka meddelande' })).toBeEnabled()
        expect(screen.getByRole('button', { name: 'Ta bort clip.mp4' })).toBeInTheDocument()
    })

})
