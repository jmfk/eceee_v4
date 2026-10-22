import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HelpInstructionVideos from '../HelpInstructionVideos'
import { supportRequest } from '../../../api/support'

vi.unmock('react-router-dom')
const state = vi.hoisted(() => ({ tenant: 'workspace-a', canPublish: false }))
vi.mock('../../support/useSupportContext', () => ({
    useSupportTenant: () => state.tenant,
    useSupportIdentity: () => 'editor',
    useSupportContext: () => ({ data: { canPublish: state.canPublish } }),
}))
vi.mock('../../support/PrivateVideoPlayer', () => ({ default: ({ id }) => <div>Private player: {id}</div> }))
vi.mock('../../../api/support', async (original) => ({ ...(await original()), supportRequest: vi.fn() }))

const renderVideos = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
            <HelpInstructionVideos guideId="pages-create"><div>Existing help video</div></HelpInstructionVideos>
        </MemoryRouter>
    </QueryClientProvider>,
)

beforeEach(() => {
    vi.clearAllMocks()
    state.tenant = 'workspace-a'
    state.canPublish = false
})

describe('instruction films in help articles', () => {
    it('keeps the existing help video when no film is linked', async () => {
        supportRequest.mockResolvedValue({ results: [] })
        renderVideos()
        expect(screen.getByText('Existing help video')).toBeInTheDocument()
        expect(await screen.findByText('Existing help video')).toBeInTheDocument()
        expect(supportRequest).toHaveBeenCalledWith('workspace-a', 'instructions/?help_guide_id=pages-create')
    })

    it('shows workspace films with private playback and a stable instruction link', async () => {
        supportRequest.mockResolvedValue({ results: [{ id: 'film-1', title: 'Skapa sidan', description: 'Guide', videoId: 'video-1' }] })
        state.canPublish = true
        renderVideos()
        expect(await screen.findByRole('heading', { name: 'Skapa sidan' })).toBeInTheDocument()
        expect(screen.getByText('Private player: video-1')).toBeInTheDocument()
        expect(screen.queryByText('Existing help video')).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Öppna filmen i Inbox' })).toHaveAttribute('href', '/inbox/instructions/film-1?tenant=workspace-a')
        expect(screen.getByRole('link', { name: 'Lägg till instruktionsfilm här' })).toHaveAttribute('href', '/inbox/publish?tenant=workspace-a&guide=pages-create')
    })

    it('keeps written-help video fallback on API failure', async () => {
        supportRequest.mockRejectedValue(new Error('Offline'))
        renderVideos()
        expect(await screen.findByRole('alert')).toHaveTextContent('Kunde inte hämta arbetsytans filmer')
        expect(screen.getByText('Existing help video')).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Lägg till instruktionsfilm här' })).not.toBeInTheDocument()
    })
})
