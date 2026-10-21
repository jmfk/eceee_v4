import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PageWidgetFactory from '../PageWidgetFactory'
import BannerWidget from '../../../widgets/easy-widgets/BannerWidget'
import TwoColumnsWidget from '../../../widgets/easy-widgets/TwoColumnsWidget'
import ThreeColumnsWidget from '../../../widgets/easy-widgets/ThreeColumnsWidget'
import SectionWidget from '../../../widgets/easy-widgets/SectionWidget'
import FooterWidget from '../../../widgets/easy-widgets/FooterWidget'
import { getWidgetComponent } from '../../../widgets'
import { mediaApi } from '../../../api'

const { publishUpdate, addNotification } = vi.hoisted(() => ({
    publishUpdate: vi.fn().mockResolvedValue(undefined),
    addNotification: vi.fn(),
}))

vi.mock('../../../widgets', () => ({
    getWidgetComponent: vi.fn(),
    getWidgetDisplayName: type => type.split('.').pop(),
    getWidgetIcon: () => null,
}))
vi.mock('../../../hooks/useWidgets', () => ({
    useWidgets: () => ({ widgetTypes: [], isLoadingTypes: false, typesError: null }),
}))
vi.mock('../../../hooks/useTheme', () => ({ useTheme: () => ({ currentTheme: null }) }))
vi.mock('../../../contexts/unified-data/context/UnifiedDataContext', () => ({
    useUnifiedData: () => ({
        useExternalChanges: vi.fn(),
        getState: () => ({ metadata: { currentVersionId: 'version-1' }, versions: {} }),
        publishUpdate,
    }),
}))
vi.mock('../../../contexts/unified-data/hooks', () => ({ useEditorContext: () => 'page' }))
vi.mock('../../../contexts/ClipboardContext', () => ({
    useClipboard: () => ({ hoveredWidgetId: null, setHoveredWidget: vi.fn(), clearHoveredWidget: vi.fn() }),
}))
vi.mock('../../../contexts/GlobalNotificationContext', () => ({
    useGlobalNotifications: () => ({ addNotification }),
}))
vi.mock('../PageWidgetSelectionModal', () => ({ default: () => null }))
vi.mock('../../../components/help/ContextualHelpLink', () => ({ default: () => null }))
vi.mock('../../../widgets/easy-widgets/SimpleTextEditorRenderer', () => ({
    SimpleTextEditorRenderer: vi.fn(function (_container, options) {
        this.options = options
        this.render = vi.fn()
        this.updateConfig = vi.fn()
        this.destroy = vi.fn()
    }),
}))
vi.mock('../../../utils/imgproxySecure', () => ({
    getImgproxyUrlFromImage: vi.fn().mockResolvedValue('/optimized.jpg'),
}))
vi.mock('../../../components/media/OptimizedImage', () => ({
    default: ({ src, alt, className }) => <img src={src} alt={alt} className={className} />,
}))
vi.mock('../../../api', () => ({
    mediaApi: { search: { search: vi.fn() }, tags: { list: vi.fn(() => async () => []) } },
    mediaTagsApi: { list: vi.fn(() => async () => []) },
    mediaCollectionsApi: { list: vi.fn(() => async () => []) },
}))

const image = {
    id: 'image-1', title: 'Available banner image', fileType: 'image',
    fileUrl: '/banner.jpg', imgproxyBaseUrl: '/banner.jpg', fileSize: 1024,
    width: 140, height: 140, tags: [],
}
const banner = (bannerMode = 'text') => ({
    id: 'banner-1', type: 'easy_widgets.BannerWidget',
    config: { bannerMode, textContent: '<p>Nested banner</p>', headerContent: '<h2>Nested header</h2>' },
})
const container = (type, slot, child) => ({
    id: `${type}-${slot}`, type: `easy_widgets.${type}`, config: { slots: { [slot]: [child] } },
})
const renderWidget = (widget, props = {}) => render(<PageWidgetFactory
    widget={widget} slotName="main" index={0} mode="editor"
    namespace="page-media" pageId="page-1" contextType="page"
    widgetPath={['main', widget.id]} {...props}
/>)

describe('Media selection inside container widgets', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        const components = { BannerWidget, TwoColumnsWidget, ThreeColumnsWidget, SectionWidget, FooterWidget }
        getWidgetComponent.mockImplementation(type => components[type.split('.').pop()])
        mediaApi.search.search.mockResolvedValue({ results: [image], count: 1 })
    })

    it.each([
        ['TwoColumnsWidget', 'left'], ['TwoColumnsWidget', 'right'],
        ['ThreeColumnsWidget', 'left'], ['ThreeColumnsWidget', 'center'], ['ThreeColumnsWidget', 'right'],
        ['SectionWidget', 'content'], ['FooterWidget', 'content'],
    ])('loads the page media library for a banner in %s / %s', async (type, slot) => {
        renderWidget(container(type, slot, banner()))

        fireEvent.click(screen.getByRole('button', { name: 'Image', exact: true }))

        expect(await screen.findByRole('heading', { name: image.title })).toBeInTheDocument()
        expect(mediaApi.search.search).toHaveBeenCalledWith(expect.objectContaining({
            namespace: 'page-media', file_type: 'image',
        }))
    })

    it.each(['text', 'header'])('keeps the namespace through several containers in %s mode', async bannerMode => {
        renderWidget(container('TwoColumnsWidget', 'right',
            container('ThreeColumnsWidget', 'center', container('SectionWidget', 'content', banner(bannerMode)))))

        fireEvent.click(screen.getByRole('button', {
            name: bannerMode === 'header' ? 'Background image' : 'Image', exact: true,
        }))

        expect(await screen.findByRole('heading', { name: image.title })).toBeInTheDocument()
        expect(mediaApi.search.search).toHaveBeenCalledWith(expect.objectContaining({ namespace: 'page-media' }))
    })

    it('preserves the namespace when controls are hidden but inline editing is enabled', async () => {
        renderWidget(container('TwoColumnsWidget', 'left', banner()), { showControls: false })
        fireEvent.click(screen.getByRole('button', { name: 'Image', exact: true }))

        expect(await screen.findByRole('heading', { name: image.title })).toBeInTheDocument()
    })

    it('selects an image from the library in an existing top-level banner', async () => {
        const onConfigChange = vi.fn()
        renderWidget(banner(), { onConfigChange })
        fireEvent.click(screen.getByRole('button', { name: 'Image', exact: true }))
        fireEvent.click(await screen.findByRole('heading', { name: image.title }))
        fireEvent.click(screen.getByRole('button', { name: 'Select (1)' }))

        await waitFor(() => expect(onConfigChange).toHaveBeenCalledWith(
            'banner-1', 'main', expect.objectContaining({ image1: expect.objectContaining({ id: image.id }) }),
        ))
    })

    it('saves the selected image on the nested banner and preserves the other column', async () => {
        const sibling = { id: 'sibling', type: 'easy_widgets.BannerWidget', config: { textContent: 'Keep this' } }
        const columns = container('TwoColumnsWidget', 'right', banner())
        columns.config.slots.left = [sibling]
        renderWidget(columns)
        fireEvent.click(screen.getAllByRole('button', { name: 'Image', exact: true })[1])
        fireEvent.click(await screen.findByRole('heading', { name: image.title }))
        fireEvent.click(screen.getByRole('button', { name: 'Select (1)' }))

        await waitFor(() => expect(publishUpdate).toHaveBeenCalledWith(
            expect.any(String), expect.any(String), expect.objectContaining({
                id: columns.id,
                widgetPath: ['main', columns.id],
                config: expect.objectContaining({ slots: {
                    left: [sibling],
                    right: [expect.objectContaining({
                        id: 'banner-1', config: expect.objectContaining({ image1: image }),
                    })],
                } }),
            }),
        ))
    })
})
