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
    kanbanApi: { get: vi.fn(), cards: vi.fn(), post: vi.fn(), patch: vi.fn(), upload: vi.fn(), background: vi.fn() },
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
        expect(screen.queryByRole('textbox', { name: 'Listnamn' })).not.toBeInTheDocument()
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
        expect(screen.queryByRole('button', { name: 'Ladda upp bilagor' })).not.toBeInTheDocument()
        expect(screen.queryByRole('combobox', { name: 'Fäst på' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Godkänn bilaga' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Importera till media' })).not.toBeInTheDocument()
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
        const comments = await screen.findByLabelText('Kommentarer och aktivitet')
        fireEvent.drop(comments, { dataTransfer: { files: [image], types: ['Files'] } })
        await waitFor(() => expect(kanbanApi.post).toHaveBeenCalledWith('cards/card-1/comments/', {
            body: '![photo.png](/api/v1/kanban/attachments/11111111-1111-1111-1111-111111111111/download/)', revision: 2,
        }))
        expect(kanbanApi.upload).toHaveBeenCalledWith('card-1', image, 1)
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
