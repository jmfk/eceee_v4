import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KanbanPage, { Attachments } from '../KanbanPage'
import { kanbanApi, kanbanError } from '../../api/kanban'
import { setCmsCopyLanguage } from '../../utils/cmsCopy'

vi.unmock('react-router-dom')
vi.mock('../../components/StatusBar', () => ({ default: () => <footer aria-label="Status">Kanban</footer> }))
vi.mock('../../components/wysiwyg/GlobalWysiwygToolbar', () => ({ default: () => null }))
vi.mock('../../components/form-fields/RichTextInput', () => ({
    default: function MockRichTextInput({ value, onChange, onImageUpload }) {
        const ref = useRef(null)
        useEffect(() => { ref.current.innerHTML = value }, [value])
        return <>
            {onImageUpload && <button type="button" onClick={onImageUpload}>Ladda upp bild</button>}
            <div ref={ref} contentEditable suppressContentEditableWarning
                onInput={(event) => onChange(event.currentTarget.innerHTML)} />
        </>
    },
}))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 42 } }) }))
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }))
vi.mock('../../utils/tenant', () => ({
    getCurrentTenantId: () => 'workspace-a',
    subscribeToCurrentTenantId: () => () => {},
}))
vi.mock('../../api/kanban', async (importOriginal) => ({
    ...(await importOriginal()),
    kanbanApi: { get: vi.fn(), cards: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), upload: vi.fn(), blob: vi.fn(), background: vi.fn() },
}))

const workspace = {
    boards: [{ id: 'board-1', title: 'Redaktionen', archived: false }],
    columns: [{ id: 'column-1', board: 'board-1', title: 'Att göra', archived: false }],
    notifications: [], members: [], labels: [],
}
const card = { id: 'card-1', column: 'column-1', shortId: 'ECE-1', title: 'Granska nyhet', assignees: [], checklist: [] }
const renderKanban = (route = '/kanban') => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[route]}>
            <Routes>
                <Route path="/kanban" element={<KanbanPage />} />
                <Route path="/kanban/boards/:boardId" element={<KanbanPage />} />
                <Route path="/kanban/cards/:cardId" element={<KanbanPage />} />
            </Routes>
        </MemoryRouter>
    </QueryClientProvider>,
)

beforeEach(() => {
    setCmsCopyLanguage('sv-se')
    vi.clearAllMocks()
    kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : {})
    kanbanApi.cards.mockResolvedValue({ results: [card] })
})

describe('Kanban application navigation', () => {
    it('keeps app navigation available while the workspace loads', () => {
        kanbanApi.get.mockReturnValue(new Promise(() => {}))
        renderKanban()
        expect(screen.getByRole('navigation', { name: 'Personliga verktyg' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Till CMS' })).toHaveAttribute('href', '/pages')
        expect(screen.getByRole('status')).toHaveTextContent('Läser arbetsytan')
        expect(screen.getByRole('contentinfo', { name: 'Status' })).toBeInTheDocument()
    })

    it('keeps app navigation and retry available when loading fails', async () => {
        kanbanApi.get.mockRejectedValue(new Error('Offline'))
        renderKanban()
        expect(await screen.findByRole('alert')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Försök igen' })).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: 'Personliga verktyg' })).toBeInTheDocument()
    })

    it('identifies the selected board and preserves card links and keyboard move actions', async () => {
        renderKanban('/kanban/boards/board-1')
        expect(await screen.findByRole('heading', { name: 'Redaktionen' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Skapa tavla' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByLabelText('Kortåtgärder för ECE-1'))
        expect(screen.getByRole('link', { name: 'Granska nyhet' })).toHaveAttribute('href', '/kanban/cards/card-1')
        expect(screen.getByRole('button', { name: 'Flytta ECE-1 upp' })).toBeDisabled()
        expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile')
    })

    it('shows board member profile images in the board header', async () => {
        const member = { id: 42, name: 'Johan Berg', username: 'johan' }
        kanbanApi.get.mockImplementation(async (path) => {
            if (path === 'workspace/') return { ...workspace, boards: [{ ...workspace.boards[0], members: [42] }], members: [member], canManageMembers: true }
            return []
        })
        renderKanban('/kanban/boards/board-1')
        const avatar = await screen.findByRole('button', { name: 'Visa medlem Johan Berg' })
        expect(avatar).toBeVisible()
        expect(avatar.querySelector('[role="img"]')).toHaveAttribute('aria-label', 'Johan Berg')
    })

    it('creates a card from the inline composer and clears cancelled text', async () => {
        kanbanApi.post.mockResolvedValue({})
        renderKanban('/kanban/boards/board-1')
        await screen.findByRole('heading', { name: 'Redaktionen' })
        fireEvent.click(screen.getByRole('button', { name: 'Lägg till kort' }))
        const title = screen.getByRole('textbox', { name: 'Kortrubrik' })
        expect(title).toHaveFocus()
        expect(screen.getByRole('button', { name: 'Lägg till kort' })).toBeDisabled()
        fireEvent.change(title, { target: { value: 'Utkast' } })
        fireEvent.click(screen.getByRole('button', { name: 'Avbryt nytt kort' }))
        fireEvent.click(screen.getByRole('button', { name: 'Lägg till kort' }))
        expect(screen.getByRole('textbox', { name: 'Kortrubrik' })).toHaveValue('')
        fireEvent.change(screen.getByRole('textbox', { name: 'Kortrubrik' }), { target: { value: '  Nytt kort  ' } })
        fireEvent.click(screen.getByRole('button', { name: 'Lägg till kort' }))
        await waitFor(() => expect(kanbanApi.post).toHaveBeenCalledWith('cards/', { title: 'Nytt kort', column: 'column-1' }))
        await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Kortrubrik' })).not.toBeInTheDocument())
    })

    it('keeps board creation in the overview and opens the created board', async () => {
        kanbanApi.post.mockResolvedValue(workspace.boards[0])
        renderKanban()
        expect(await screen.findByRole('link', { name: 'Redaktionen' })).toHaveAttribute('href', '/kanban/boards/board-1')
        expect(screen.queryByRole('textbox', { name: 'Tavelnamn' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Skapa tavla' }))
        fireEvent.change(screen.getByRole('textbox', { name: 'Tavelnamn' }), { target: { value: 'Ny tavla' } })
        fireEvent.click(screen.getByRole('textbox', { name: 'Tavelnamn' }).closest('form').querySelector('button'))
        expect(await screen.findByRole('heading', { name: 'Redaktionen' })).toBeInTheDocument()
        expect(kanbanApi.post).toHaveBeenCalledWith('boards/', { title: 'Ny tavla' })
        expect(screen.queryByRole('textbox', { name: 'Tavelnamn' })).not.toBeInTheDocument()
    })

    it('opens filters and creates a list from the board actions menu', async () => {
        kanbanApi.post.mockResolvedValue({})
        renderKanban('/kanban/boards/board-1')
        await screen.findByRole('heading', { name: 'Redaktionen' })
        expect(screen.queryByRole('textbox', { name: 'Sök kort' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Lägg till lista' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Byt tavla' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
        expect(screen.getByRole('textbox', { name: 'Sök kort' })).toBeVisible()
        fireEvent.click(screen.getByRole('button', { name: 'Tavelåtgärder' }))
        expect(await screen.findByRole('link', { name: 'Byt tavla' })).toHaveAttribute('href', '/kanban')
        fireEvent.click(await screen.findByRole('button', { name: 'Lägg till lista' }))
        expect(screen.getByRole('textbox', { name: 'Listnamn' })).toHaveFocus()
        fireEvent.change(screen.getByRole('textbox', { name: 'Listnamn' }), { target: { value: 'Pågår' } })
        fireEvent.click(screen.getByRole('button', { name: 'Lägg till lista' }))
        await waitFor(() => expect(kanbanApi.post).toHaveBeenCalledWith('boards/board-1/columns/', expect.objectContaining({ title: 'Pågår' })))
        await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Listnamn' })).not.toBeInTheDocument())
    })

    it('keeps selected filters when the filter popup closes and can clear them', async () => {
        renderKanban('/kanban/boards/board-1')
        await screen.findByRole('heading', { name: 'Redaktionen' })
        fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
        expect(screen.getByRole('dialog', { name: 'Filtrera kort' })).toBeVisible()
        expect(screen.getByRole('textbox', { name: 'Sök kort' })).toHaveFocus()
        const option = (text) => screen.getByText(text).closest('label').querySelector('input')
        fireEvent.click(option('Mina uppgifter'))
        fireEvent.click(option('Försenade'))
        await waitFor(() => expect(kanbanApi.cards).toHaveBeenCalledWith(expect.objectContaining({ mine: true, deadline: 'overdue' })))
        fireEvent.click(screen.getByRole('button', { name: 'Stäng filter' }))
        expect(screen.queryByRole('dialog', { name: 'Filtrera kort' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
        expect(option('Mina uppgifter')).toBeChecked()
        expect(option('Försenade')).toBeChecked()
        fireEvent.click(screen.getByRole('button', { name: 'Rensa filter' }))
        expect(option('Mina uppgifter')).not.toBeChecked()
        expect(option('Alla datum')).toBeChecked()
    })

    it('shows image generation progress and warns before cancelling it', async () => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? {
            ...workspace,
            boards: [{ ...workspace.boards[0], revision: 1 }],
            canGenerateImages: true,
        } : {})
        kanbanApi.post.mockImplementation((_path, _data, options) => new Promise((resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }))
        try {
            renderKanban('/kanban/boards/board-1')
            await screen.findByRole('heading', { name: 'Redaktionen' })
            fireEvent.click(screen.getByRole('button', { name: 'Tavelåtgärder' }))
            fireEvent.click(await screen.findByRole('button', { name: 'Redigera tavlan' }))
            fireEvent.change(screen.getByLabelText('Beskriv bakgrundsbilden'), { target: { value: 'Hav vid gryningen' } })
            fireEvent.click(screen.getByRole('button', { name: 'Generera från beskrivning' }))
            expect(await screen.findByRole('status')).toHaveTextContent('Genererar bakgrundsbild')
            const signal = kanbanApi.post.mock.calls[0][2].signal
            const unload = new Event('beforeunload', { cancelable: true })
            window.dispatchEvent(unload)
            expect(unload.defaultPrevented).toBe(true)
            fireEvent.click(screen.getByRole('button', { name: 'Stäng dialog' }))
            expect(confirm).toHaveBeenCalledOnce()
            expect(screen.getByRole('dialog')).toBeVisible()
            expect(signal.aborted).toBe(false)
            confirm.mockReturnValue(true)
            fireEvent.click(screen.getByRole('button', { name: 'Stäng dialog' }))
            expect(signal.aborted).toBe(true)
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        } finally {
            confirm.mockRestore()
        }
    })

    it('places a board background behind the full screen instead of only the lists', async () => {
        const createObjectURL = URL.createObjectURL
        const revokeObjectURL = URL.revokeObjectURL
        URL.createObjectURL = vi.fn(() => 'blob:board-background')
        URL.revokeObjectURL = vi.fn()
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? {
            ...workspace,
            boards: [{ ...workspace.boards[0], hasBackground: true, revision: 1 }],
        } : {})
        kanbanApi.background.mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
        const view = renderKanban('/kanban/boards/board-1')
        try {
            const lists = await screen.findByLabelText('Kanban-kolumner')
            const shell = lists.closest('.user-tools-shell')
            await waitFor(() => expect(shell.style.backgroundImage).toContain('blob:board-background'))
            expect(shell).toHaveClass('kb-board-background')
            expect(lists.style.backgroundImage).toBe('')
        } finally {
            view.unmount()
            URL.createObjectURL = createObjectURL
            URL.revokeObjectURL = revokeObjectURL
        }
    })

})

describe('Kanban card attachments', () => {
    const attachmentCard = {
        ...card, board: 'board-1', revision: 1, description: '', deadline: null, labels: [],
        externalReferences: [], comments: [], attachments: [], activity: [],
    }
    const attachmentWorkspace = { fileTypes: { 'text/plain': ['.txt'] } }

    it('selects card members from a searchable board member popup and saves assignees', async () => {
        const members = [
            { id: 42, name: 'Johan Berg', username: 'johan' },
            { id: 43, name: 'Ylva Blume', username: 'ylva' },
            { id: 44, name: 'Outside Member', username: 'outside' },
        ]
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? {
            ...workspace, boards: [{ ...workspace.boards[0], members: [42, 43] }], members,
        } : { ...attachmentCard, assignees: [42] })
        kanbanApi.patch.mockResolvedValue({ ...attachmentCard, assignees: [43] })
        renderKanban('/kanban/cards/card-1')
        fireEvent.click(await screen.findByRole('button', { name: 'Ändra medlemmar' }))
        expect(screen.getByRole('heading', { name: 'Kortmedlemmar' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Tavlemedlemmar' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Ta bort Johan Berg från kortet' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Lägg till Outside Member på kortet' })).not.toBeInTheDocument()
        fireEvent.change(screen.getByRole('searchbox', { name: 'Sök medlem' }), { target: { value: 'ylva' } })
        expect(screen.queryByRole('button', { name: 'Ta bort Johan Berg från kortet' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Lägg till Ylva Blume på kortet' }))
        expect(screen.getByRole('button', { name: 'Ta bort Ylva Blume från kortet' })).toBeInTheDocument()
        fireEvent.change(screen.getByRole('searchbox', { name: 'Sök medlem' }), { target: { value: '' } })
        fireEvent.click(screen.getByRole('button', { name: 'Ta bort Johan Berg från kortet' }))
        fireEvent.click(screen.getByRole('button', { name: 'Spara kort' }))
        await waitFor(() => expect(kanbanApi.patch).toHaveBeenCalledWith('cards/card-1/', expect.objectContaining({ assignees: [43] })))
    })

    it('opens the member popup from the card add menu', async () => {
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : attachmentCard)
        renderKanban('/kanban/cards/card-1')
        fireEvent.click(await screen.findByRole('button', { name: 'Lägg till' }))
        fireEvent.click(screen.getByRole('button', { name: 'Medlemmar' }))
        expect(await screen.findByRole('searchbox', { name: 'Sök medlem' })).toBeVisible()
    })

    it('opens a clicked description image selected in the visual editor', async () => {
        const id = '11111111-1111-1111-1111-111111111111'
        const image = { id, filename: 'portrait.png', size: 4, contentType: 'image/png', imports: [] }
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : {
            ...attachmentCard, description: `![portrait](/api/v1/kanban/attachments/${id}/download/)`, attachments: [image],
        })
        renderKanban('/kanban/cards/card-1')
        fireEvent.click(await screen.findByRole('button', { name: 'Redigera bild portrait' }))
        expect(await screen.findByRole('toolbar', { name: 'Bildinställningar för portrait' })).toBeVisible()
    })

    it('opens a clicked comment image selected for comment editing', async () => {
        const id = '11111111-1111-1111-1111-111111111111'
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : {
            ...attachmentCard,
            comments: [{ id: 'comment-1', body: `![portrait](/api/v1/kanban/attachments/${id}/download/)`,
                author: { id: 42, name: 'Johan' }, createdAt: '2026-01-01T12:00:00Z' }],
        })
        renderKanban('/kanban/cards/card-1')
        fireEvent.click(await screen.findByRole('button', { name: 'Redigera bild portrait' }))
        expect(await screen.findByRole('toolbar', { name: 'Bildinställningar för portrait' })).toBeVisible()
        expect(screen.getByRole('button', { name: 'Spara kommentar' })).toBeInTheDocument()
    })

    it('uploads files dropped on a card in the board without moving it', async () => {
        let revision = 1
        const first = new File(['first'], 'first.txt', { type: 'text/plain' })
        const second = new File(['second'], 'second.txt', { type: 'text/plain' })
        kanbanApi.cards.mockResolvedValue({ results: [attachmentCard] })
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : { ...attachmentCard, revision })
        kanbanApi.upload.mockImplementation(async () => { revision += 1; return {} })
        renderKanban('/kanban/boards/board-1')
        const title = await screen.findByRole('link', { name: 'Granska nyhet' })
        const dataTransfer = { files: [first, second], types: ['Files'] }
        expect(fireEvent.dragOver(title, { dataTransfer })).toBe(false)
        fireEvent.drop(title, { dataTransfer })
        await waitFor(() => expect(kanbanApi.upload).toHaveBeenCalledTimes(2))
        expect(kanbanApi.upload).toHaveBeenNthCalledWith(1, 'card-1', first, 1)
        expect(kanbanApi.upload).toHaveBeenNthCalledWith(2, 'card-1', second, 2)
        expect(kanbanApi.patch).not.toHaveBeenCalled()
    })

    it('shows existing attachments without an upload form below the card', () => {
        render(<Attachments
            card={{ ...attachmentCard, attachments: [{ id: 'file-1', filename: 'note.txt', size: 4, contentType: 'text/plain' }] }}
        />)
        expect(screen.getByRole('link', { name: 'note.txt' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'note.txt' }).closest('li')).toHaveClass('kb-attachment-card')
        expect(screen.queryByRole('button', { name: 'Ladda upp bilagor' })).not.toBeInTheDocument()
        expect(screen.queryByRole('combobox', { name: 'Fäst på' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Godkänn bilaga' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Importera till media' })).not.toBeInTheDocument()
    })

    it('groups image actions into a compact attachment toolbar', () => {
        const remove = vi.fn()
        render(<Attachments card={{ ...attachmentCard, attachments: [{
            id: 'file-1', filename: 'portrait.png', size: 4, contentType: 'image/png',
        }] }} onDelete={remove} />)
        const toolbar = screen.getByRole('toolbar', { name: 'Åtgärder för portrait.png' })
        expect(toolbar).toHaveClass('kb-attachment-toolbar')
        const card = screen.getByRole('link', { name: 'portrait.png' }).closest('li')
        expect(card).toHaveClass('kb-attachment-card')
        expect(card.querySelectorAll('img')).toHaveLength(1)
        expect(card.querySelector('img').closest('.kb-attachment-thumb')).toBeInTheDocument()
        expect(toolbar.querySelectorAll('button')).toHaveLength(2)
        fireEvent.click(screen.getByRole('button', { name: 'Ta bort bilaga' }))
        expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'file-1' }))
    })

    it('asks before deleting a card image and refreshes the card after deletion', async () => {
        const image = { id: 'file-1', filename: 'portrait.png', size: 4, contentType: 'image/png', imports: [] }
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : { ...attachmentCard, attachments: [image] })
        kanbanApi.delete.mockResolvedValue({})
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
        try {
            renderKanban('/kanban/cards/card-1')
            const remove = await screen.findByRole('button', { name: 'Ta bort bilaga' })
            fireEvent.click(remove)
            expect(confirm).toHaveBeenCalledWith(expect.stringContaining('portrait.png'))
            expect(kanbanApi.delete).not.toHaveBeenCalled()
            confirm.mockReturnValue(true)
            fireEvent.click(remove)
            await waitFor(() => expect(kanbanApi.delete).toHaveBeenCalledWith('attachments/file-1/', { revision: 1 }))
        } finally {
            confirm.mockRestore()
        }
    })

    it('explains when the server reuses an identical attachment', async () => {
        const image = new File(['portrait'], 'portrait.png', { type: 'image/png' })
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : attachmentCard)
        kanbanApi.upload.mockResolvedValue({ id: 'file-1', duplicate: true })
        renderKanban('/kanban/cards/card-1')
        await screen.findByRole('button', { name: 'Bilaga', exact: true })
        fireEvent.drop(document.querySelector('.kb-detail'), {
            dataTransfer: { files: [image], items: [{ kind: 'file', type: image.type, getAsFile: () => image }], types: ['Files'] },
        })
        expect(await screen.findByRole('status')).toHaveTextContent('En identisk bilaga finns redan')
    })

    it('opens the picker from Bilaga and uploads files dropped anywhere on the card', async () => {
        let revision = 1
        const first = new File(['first'], 'first.txt', { type: 'text/plain' })
        const second = new File(['second'], 'second.txt', { type: 'text/plain' })
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? { ...workspace, ...attachmentWorkspace } : path === 'cards/card-1/' ? { ...attachmentCard, revision } : {})
        kanbanApi.upload.mockImplementation(async () => { revision += 1; return {} })
        renderKanban('/kanban/cards/card-1')
        const button = await screen.findByRole('button', { name: 'Bilaga', exact: true })
        const input = document.querySelector('.kb-detail input[type="file"]')
        const click = vi.spyOn(input, 'click')
        fireEvent.click(button)
        expect(click).toHaveBeenCalledOnce()
        expect(screen.queryByRole('region', { name: 'Bilagor' })).not.toBeInTheDocument()
        const dataTransfer = {
            files: [first, second],
            items: [first, second].map((file) => ({ kind: 'file', type: file.type, getAsFile: () => file })),
            types: ['Files'],
        }
        fireEvent.dragEnter(document.querySelector('.kb-detail'), { dataTransfer })
        expect(screen.queryByText('Släpp filer för att bifoga dem till kortet')).not.toBeInTheDocument()
        fireEvent.drop(document.querySelector('.kb-detail'), { dataTransfer })
        await waitFor(() => expect(kanbanApi.upload).toHaveBeenCalledTimes(2))
        expect(kanbanApi.upload).toHaveBeenNthCalledWith(1, 'card-1', first, 1)
        expect(kanbanApi.upload).toHaveBeenNthCalledWith(2, 'card-1', second, 2)
    })

    it('does not print a server HTML error page inside the card', () => {
        expect(kanbanError({ response: { status: 500, data: '<!DOCTYPE html><html>error</html>' } }))
            .toBe('Servern kunde inte slutföra åtgärden. Försök igen senare.')
    })

    it('attaches a file to a new comment when dropped in the comment area', async () => {
        let revision = 1
        const image = new File(['image'], 'photo.png', { type: 'image/png' })
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : path === 'cards/card-1/' ? { ...attachmentCard, revision } : {})
        kanbanApi.post.mockResolvedValue({ id: 'comment-1' })
        kanbanApi.upload.mockImplementation(async () => { revision += 1; return { id: '11111111-1111-1111-1111-111111111111', filename: 'photo.png', contentType: 'image/png' } })
        renderKanban('/kanban/cards/card-1')
        const prompt = await screen.findByRole('button', { name: 'Skriv en kommentar…' })
        const dataTransfer = { files: [image], types: ['Files'] }
        expect(fireEvent.dragOver(prompt, { dataTransfer })).toBe(false)
        fireEvent.drop(prompt, { dataTransfer })
        await waitFor(() => expect(kanbanApi.post).toHaveBeenCalledWith('cards/card-1/comments/', {
            body: '![photo.png](/api/v1/kanban/attachments/11111111-1111-1111-1111-111111111111/download/)', revision: 2,
        }))
        expect(kanbanApi.upload).toHaveBeenCalledWith('card-1', image, 1)
    })

    it('adds an existing attachment image as a comment without uploading it again', async () => {
        const imageId = '11111111-1111-1111-1111-111111111111'
        const existing = { ...attachmentCard, attachments: [{ id: imageId, filename: 'portrait.jpg', contentType: 'image/jpeg', size: 1024 }] }
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : path === 'cards/card-1/' ? existing : {})
        kanbanApi.post.mockResolvedValue({ id: 'comment-1' })
        renderKanban('/kanban/cards/card-1')
        const image = await screen.findByAltText('portrait.jpg')
        const payload = {}
        const draggedFile = new File(['image'], 'portrait.jpg', { type: 'image/jpeg' })
        const dataTransfer = {
            files: [draggedFile], types: ['Files'],
            setData: (type, value) => { payload[type] = value; dataTransfer.types.push(type) },
            getData: (type) => payload[type] || '',
        }
        fireEvent.dragStart(image, { dataTransfer })
        const prompt = screen.getByRole('button', { name: 'Skriv en kommentar…' })
        expect(fireEvent.dragOver(prompt, { dataTransfer })).toBe(false)
        fireEvent.drop(prompt, { dataTransfer })
        await waitFor(() => expect(kanbanApi.post).toHaveBeenCalledWith('cards/card-1/comments/', {
            body: `![portrait.jpg](/api/v1/kanban/attachments/${imageId}/download/)`, revision: 1,
        }))
        expect(kanbanApi.upload).not.toHaveBeenCalled()
    })

    it('reuses an identical image attachment when the same local file is dropped on comments', async () => {
        const imageId = '11111111-1111-1111-1111-111111111111'
        const image = new File(['same'], 'portrait.jpg', { type: 'image/jpeg' })
        const bytes = new TextEncoder().encode('same').buffer
        Object.defineProperty(image, 'arrayBuffer', { value: async () => bytes })
        const existing = { ...attachmentCard, attachments: [{ id: imageId, filename: 'portrait.jpg', contentType: 'image/jpeg', size: image.size }] }
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : path === 'cards/card-1/' ? existing : {})
        kanbanApi.blob.mockResolvedValue({ arrayBuffer: async () => bytes })
        kanbanApi.post.mockResolvedValue({ id: 'comment-1' })
        renderKanban('/kanban/cards/card-1')
        fireEvent.drop(await screen.findByRole('button', { name: 'Skriv en kommentar…' }), {
            dataTransfer: { files: [image], types: ['Files'] },
        })
        await waitFor(() => expect(kanbanApi.post).toHaveBeenCalledWith('cards/card-1/comments/', {
            body: `![portrait.jpg](/api/v1/kanban/attachments/${imageId}/download/)`, revision: 1,
        }))
        expect(kanbanApi.upload).not.toHaveBeenCalled()
    })

    it('uploads a different image even when its size matches an attachment', async () => {
        const image = new File(['new!'], 'portrait.jpg', { type: 'image/jpeg' })
        Object.defineProperty(image, 'arrayBuffer', { value: async () => new TextEncoder().encode('new!').buffer })
        const existing = { ...attachmentCard, attachments: [{ id: '11111111-1111-1111-1111-111111111111', filename: 'portrait.jpg', contentType: 'image/jpeg', size: image.size }] }
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : path === 'cards/card-1/' ? existing : {})
        kanbanApi.blob.mockResolvedValue({ arrayBuffer: async () => new TextEncoder().encode('old!').buffer })
        kanbanApi.upload.mockResolvedValue({ id: '22222222-2222-2222-2222-222222222222', filename: 'portrait.jpg', contentType: 'image/jpeg' })
        kanbanApi.post.mockResolvedValue({ id: 'comment-1' })
        renderKanban('/kanban/cards/card-1')
        fireEvent.drop(await screen.findByRole('button', { name: 'Skriv en kommentar…' }), {
            dataTransfer: { files: [image], types: ['Files'] },
        })
        await waitFor(() => expect(kanbanApi.upload).toHaveBeenCalledWith('card-1', image, 1))
    })

    it('does not create an empty attachment comment when upload fails', async () => {
        const image = new File(['invalid'], 'photo.png', { type: 'image/png' })
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : path === 'cards/card-1/' ? attachmentCard : {})
        kanbanApi.upload.mockRejectedValue(new Error('Invalid image'))
        renderKanban('/kanban/cards/card-1')
        fireEvent.drop(await screen.findByLabelText('Kommentarer och aktivitet'), {
            dataTransfer: { files: [image], types: ['Files'] },
        })
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid image'))
        expect(kanbanApi.post).not.toHaveBeenCalled()
    })

    it('uploads an image dropped into the description editor and saves it inline', async () => {
        const image = new File(['image'], 'photo.png', { type: 'image/png' })
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : path === 'cards/card-1/' ? attachmentCard : {})
        kanbanApi.upload.mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111', filename: 'photo.png', contentType: 'image/png' })
        kanbanApi.patch.mockResolvedValue(attachmentCard)
        renderKanban('/kanban/cards/card-1')
        fireEvent.click(await screen.findByRole('button', { name: 'Redigera beskrivning' }))
        const visual = document.querySelector('.kb-detail-description .kb-editor-visual')
        fireEvent.drop(visual, { dataTransfer: { files: [image], types: ['Files'] } })
        await waitFor(() => expect(kanbanApi.upload).toHaveBeenCalledWith('card-1', image, 1))
        await waitFor(() => expect(visual.querySelector('img')).toHaveAttribute('alt', 'photo.png'))
        fireEvent.click(screen.getByRole('button', { name: 'Spara', exact: true }))
        await waitFor(() => expect(kanbanApi.patch).toHaveBeenCalledWith('cards/card-1/', expect.objectContaining({
            description: expect.stringContaining('![photo.png](/api/v1/kanban/attachments/11111111-1111-1111-1111-111111111111/download/)'),
        })))
    })

    it('opens the file picker from the editor image button and inserts the upload', async () => {
        const image = new File(['image'], 'picked.png', { type: 'image/png' })
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : path === 'cards/card-1/' ? attachmentCard : {})
        kanbanApi.upload.mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111', filename: 'picked.png', contentType: 'image/png' })
        renderKanban('/kanban/cards/card-1')
        fireEvent.click(await screen.findByRole('button', { name: 'Redigera beskrivning' }))
        const picker = screen.getByLabelText('Ladda upp bild i Beskrivning')
        const click = vi.spyOn(picker, 'click')
        fireEvent.click(screen.getByRole('button', { name: 'Ladda upp bild' }))
        expect(click).toHaveBeenCalledOnce()
        fireEvent.change(picker, { target: { files: [image] } })
        await waitFor(() => expect(kanbanApi.upload).toHaveBeenCalledWith('card-1', image, 1))
        await waitFor(() => expect(document.querySelector('.kb-detail-description .kb-editor-visual img')).toHaveAttribute('alt', 'picked.png'))
    })

    it('moves an existing inline image to another position in the editor', async () => {
        const description = '![first](/api/v1/kanban/attachments/11111111-1111-1111-1111-111111111111/download/)\n\nEnd'
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : path === 'cards/card-1/' ? { ...attachmentCard, description } : {})
        kanbanApi.patch.mockResolvedValue({ ...attachmentCard, description })
        renderKanban('/kanban/cards/card-1')
        fireEvent.click(await screen.findByRole('button', { name: 'Redigera beskrivning' }))
        const visual = document.querySelector('.kb-detail-description .kb-editor-visual')
        const editor = visual.querySelector('[contenteditable="true"]')
        const image = editor.querySelector('img')
        document.caretRangeFromPoint = vi.fn(() => {
            const range = document.createRange()
            range.selectNodeContents(editor)
            range.collapse(false)
            return range
        })
        fireEvent.dragStart(image, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
        fireEvent.drop(visual, { dataTransfer: { files: [], types: ['application/x-kanban-inline-image'] } })
        fireEvent.click(screen.getByRole('button', { name: 'Spara', exact: true }))
        await waitFor(() => expect(kanbanApi.patch).toHaveBeenCalled())
        const saved = kanbanApi.patch.mock.calls[0][1].description
        expect(saved.indexOf('End')).toBeLessThan(saved.indexOf('![first]'))
        delete document.caretRangeFromPoint
    })

    it('inserts an existing attachment image into rich text without uploading it again', async () => {
        const imageId = '11111111-1111-1111-1111-111111111111'
        const existing = { ...attachmentCard, attachments: [{ id: imageId, filename: 'portrait.jpg', contentType: 'image/jpeg', size: 1024 }] }
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : path === 'cards/card-1/' ? existing : {})
        kanbanApi.patch.mockResolvedValue(existing)
        renderKanban('/kanban/cards/card-1')
        fireEvent.click(await screen.findByRole('button', { name: 'Redigera beskrivning' }))
        const image = screen.getByAltText('portrait.jpg')
        const payload = {}
        const dataTransfer = {
            files: [], types: [],
            setData: (type, value) => { payload[type] = value; dataTransfer.types.push(type) },
            getData: (type) => payload[type] || '',
        }
        fireEvent.dragStart(image, { dataTransfer })
        expect(dataTransfer.types).toContain('application/x-kanban-inline-image')
        const visual = document.querySelector('.kb-detail-description .kb-editor-visual')
        expect(fireEvent.dragOver(visual, { dataTransfer })).toBe(false)
        fireEvent.drop(visual, { dataTransfer })
        expect(visual.querySelector('img')).toHaveAttribute('alt', 'portrait.jpg')
        fireEvent.click(screen.getByRole('button', { name: 'Spara', exact: true }))
        await waitFor(() => expect(kanbanApi.patch).toHaveBeenCalledWith('cards/card-1/', expect.objectContaining({
            description: `![portrait.jpg](/api/v1/kanban/attachments/${imageId}/download/)`,
        })))
        expect(kanbanApi.upload).not.toHaveBeenCalled()
    })

    it('adds an existing editor image to a comment when dropped in the activity area', async () => {
        const description = '![first](/api/v1/kanban/attachments/11111111-1111-1111-1111-111111111111/download/)'
        kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : path === 'cards/card-1/' ? { ...attachmentCard, description } : {})
        kanbanApi.post.mockResolvedValue({ id: 'comment-1' })
        renderKanban('/kanban/cards/card-1')
        fireEvent.click(await screen.findByRole('button', { name: 'Redigera beskrivning' }))
        const image = document.querySelector('.kb-detail-description .kb-editor-visual img')
        const dataTransfer = { files: [], types: ['application/x-kanban-inline-image'], setData: vi.fn(), getData: () => JSON.stringify({ id: '11111111-1111-1111-1111-111111111111', name: 'first' }) }
        fireEvent.dragStart(image, { dataTransfer })
        fireEvent.drop(screen.getByLabelText('Kommentarer och aktivitet'), { dataTransfer })
        await waitFor(() => expect(kanbanApi.post).toHaveBeenCalledWith('cards/card-1/comments/', {
            body: description, revision: 1,
        }))
        expect(kanbanApi.upload).not.toHaveBeenCalled()
    })
})
