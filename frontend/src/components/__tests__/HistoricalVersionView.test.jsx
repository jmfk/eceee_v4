import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HistoricalObjectView, HistoricalPageView } from '../HistoricalVersionView'

const mocks = vi.hoisted(() => ({ page: vi.fn(), layout: vi.fn(), object: vi.fn(), term: vi.fn() }))
vi.mock('../../api/client', () => ({ api: { get: mocks.page } }))
vi.mock('../../api/endpoints', () => ({ endpoints: { versions: { pageVersionDetail: (pageId, versionId) => `/pages/${pageId}/versions/${versionId}/` } } }))
vi.mock('../../api', () => ({ layoutsApi: { getJson: mocks.layout } }))
vi.mock('../../api/objectStorage', () => ({ objectVersionsApi: { get: mocks.object } }))
vi.mock('../../api/taxonomy', () => ({ taxonomyApi: { term: mocks.term } }))
vi.mock('../../editors/page-editor/PageContentEditor', () => ({ default: ({ pageVersionData, editable, localWidgets }) =>
    <div data-testid="page-content" data-editable={String(editable)}>{pageVersionData.versionTitle} {localWidgets.main?.[0]?.name}</div> }))
vi.mock('../../editors/object-editor/ObjectWidgetFactory', () => ({ default: ({ widget, showControls, mode }) =>
    <div data-testid="object-widget" data-controls={String(showControls)} data-mode={mode}>{widget.name}</div> }))

const mount = component => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{component}</QueryClientProvider>)

beforeEach(() => {
    vi.clearAllMocks()
    mocks.page.mockResolvedValue({ data: { id: 7, versionNumber: 2, versionTitle: 'Old page', codeLayout: 'main_layout', widgets: { main: [{ name: 'Old widget' }] }, pageData: { pageAttributes: { title: 'Old title' } } } })
    mocks.layout.mockResolvedValue({ name: 'main_layout' })
    mocks.object.mockResolvedValue({ data: { id: 9, versionNumber: 1, title: 'Old object', data: { venue: 'Online' }, widgets: { main: [{ id: 'w1', name: 'Old object widget' }] }, classificationIds: ['tag-1'] } })
    mocks.term.mockResolvedValue({ id: 'tag-1', path: 'Ämne / Energy' })
})

describe('historical editor views', () => {
    it('renders page version content read-only and returns to history', async () => {
        const onClose = vi.fn()
        mount(<HistoricalPageView pageId={4} versionId="7" webpageData={{ title: 'Working title' }} onClose={onClose} />)
        expect(await screen.findByTestId('page-content')).toHaveAttribute('data-editable', 'false')
        expect(screen.getByTestId('page-content')).toHaveTextContent('Old widget')
        expect(screen.getByText(/Viewing version 2 · Read only/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Back to history' }))
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('renders historical object properties, widgets and tags without edit controls', async () => {
        mount(<HistoricalObjectView versionId="9" objectType={{ schema: { properties: { venue: { title: 'Venue' } } }, slotConfiguration: { slots: [{ name: 'main', label: 'Content' }] } }} onClose={vi.fn()} />)
        expect(await screen.findByText('Old object')).toBeInTheDocument()
        expect(screen.getByText('Online')).toBeInTheDocument()
        expect(screen.getByTestId('object-widget')).toHaveAttribute('data-controls', 'false')
        expect(screen.getByTestId('object-widget')).toHaveAttribute('data-mode', 'preview')
        fireEvent.click(screen.getByRole('button', { name: 'Tags' }))
        expect(await screen.findByText('Ämne / Energy')).toBeInTheDocument()
    })
})
