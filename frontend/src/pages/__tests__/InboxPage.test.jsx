import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InboxPage from '../InboxPage'
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
        fireEvent.change(screen.getByLabelText('Typ (valfri)'), {
            target: { value: 'question' },
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
        fireEvent.change(screen.getByLabelText('Typ (valfri)'), {
            target: { value: 'question' },
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
                kind: 'question',
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
