import type { RenderWidgetModel } from './types'

const news = [
    { id: 'news-1', title: 'A representative news story', path: '#news-1', data: { excerpt: 'A short summary that makes typography and spacing visible.' } },
    { id: 'news-2', title: 'A second example story', path: '#news-2', data: { excerpt: 'Another predictable item for list and grid previews.' } },
]

const widget = (type: string, config: Record<string, any>, data?: Record<string, any>): RenderWidgetModel => ({
    id: `fixture-${type.split('.').pop()}`,
    type,
    config,
    data: data as any,
})

export const RENDER_WIDGET_FIXTURES: Record<string, RenderWidgetModel> = {
    'easy_widgets.FooterWidget': widget('easy_widgets.FooterWidget', { content: '<p>Example footer content</p>' }),
    'easy_widgets.ContentWidget': widget('easy_widgets.ContentWidget', { content: '<h2>A content heading</h2><p>Longer representative content shows line length, rhythm and spacing.</p>' }),
    'easy_widgets.ContentCardWidget': widget('easy_widgets.ContentCardWidget', { header: 'Card heading', content: '<p>Representative card content.</p>', imageSize: 'rectangle', image1: { url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="280" height="140"%3E%3Crect width="100%25" height="100%25" fill="%2394a3b8"/%3E%3C/svg%3E', altText: 'Card preview' }, showBorder: true }),
    'easy_widgets.BannerWidget': widget('easy_widgets.BannerWidget', { bannerMode: 'text', textContent: '<h3>Banner heading</h3><p>Banner supporting text.</p>', imageSize: 'square', showBorder: true }),
    'easy_widgets.BioWidget': widget('easy_widgets.BioWidget', { bioText: '<p>A concise biography used in theme previews.</p>', caption: 'Example Person', textLayout: 'column', image: { url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="280" height="320"%3E%3Crect width="100%25" height="100%25" fill="%23cbd5e1"/%3E%3C/svg%3E', altText: 'Example Person' } }),
    'easy_widgets.ImageWidget': widget('easy_widgets.ImageWidget', { image: { url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="450"%3E%3Crect width="100%25" height="100%25" fill="%23d1d5db"/%3E%3C/svg%3E' }, alt_text: 'Preview image', caption: 'Representative image caption' }),
    'easy_widgets.TableWidget': widget('easy_widgets.TableWidget', { caption: 'Representative values', showBorders: true, stripedRows: true, responsive: true, tableWidth: 'full', columnWidths: ['70%', '30%'], rows: [{ isHeader: true, cells: [{ content: 'Name', alignment: 'left' }, { content: 'Value', alignment: 'right' }] }, { cells: [{ content: '<strong>First</strong>', alignment: 'left' }, { content: '100', alignment: 'right' }] }] }),
    'easy_widgets.HeaderWidget': widget('easy_widgets.HeaderWidget', {}),
    'easy_widgets.HeadlineWidget': widget('easy_widgets.HeadlineWidget', { content: 'A heading with realistic length', headerLevel: 'h2', showBorder: false }),
    'easy_widgets.HeroWidget': widget('easy_widgets.HeroWidget', { beforeText: 'Current topic', header: 'A strong hero heading', afterText: 'Supporting copy for the primary message.', image: { imgproxyBaseUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1280" height="500"%3E%3Crect width="100%25" height="100%25" fill="%23334155"/%3E%3C/svg%3E' }, textColor: '#ffffff', decorColor: '#e2e8f0', backgroundColor: '#334155' }),
    'easy_widgets.NavbarWidget': widget('easy_widgets.NavbarWidget', { menuItems: [{ linkData: { type: 'external', label: 'Home', url: '#', isActive: true } }, { linkData: { type: 'external', label: 'Articles', url: '#', isActive: true } }, { linkData: { type: 'external', label: 'About', url: '#', isActive: true } }], secondaryMenuItems: [] }),
    'easy_widgets.NavigationWidget': widget('easy_widgets.NavigationWidget', { menuItems: [{ linkData: { type: 'external', label: 'First page', url: '#', isActive: true } }, { linkData: { type: 'external', label: 'Second page', url: '#', isActive: true } }] }),
    'easy_widgets.SidebarWidget': widget('easy_widgets.SidebarWidget', { content: '<p>Sidebar fallback</p>', position: 'right', widgets: [{ title: 'Related content', content: '<p>Useful context</p>' }, { title: 'Quick links', type: 'list', items: [{ title: 'First page', url: '/first/', description: 'A representative internal link' }] }] }),
    'easy_widgets.FormsWidget': widget('easy_widgets.FormsWidget', { title: 'Contact form', description: 'Representative field controls', fields: [{ name: 'name', label: 'Name', type: 'text', required: true }, { name: 'message', label: 'Message', type: 'textarea' }, { name: 'topic', label: 'Topic', type: 'select', options: ['General', 'Press'] }, { name: 'updates', label: 'Updates', type: 'checkbox', options: ['Email'] }, { name: 'priority', label: 'Priority', type: 'radio', options: ['Normal', 'Urgent'] }, { name: 'attachment', label: 'Attachment', type: 'file' }, { name: 'date', label: 'Date', type: 'date' }], submitButtonText: 'Send' }),
    'easy_widgets.TwoColumnsWidget': widget('easy_widgets.TwoColumnsWidget', { slots: { left: [widget('easy_widgets.HeadlineWidget', { content: 'Left column', level: 3 })], right: [widget('easy_widgets.ContentWidget', { content: '<p>Right column content.</p>' })] } }),
    'easy_widgets.ThreeColumnsWidget': widget('easy_widgets.ThreeColumnsWidget', { slots: { left: [widget('easy_widgets.ContentWidget', { content: '<p>First</p>' })], center: [widget('easy_widgets.ContentWidget', { content: '<p>Second</p>' })], right: [widget('easy_widgets.ContentWidget', { content: '<p>Third</p>' })] } }),
    'easy_widgets.PathDebugWidget': widget('easy_widgets.PathDebugWidget', {}),
    'easy_widgets.NewsListWidget': widget('easy_widgets.NewsListWidget', { objectTypes: ['news'] }, { status: 'ready', items: news }),
    'easy_widgets.NewsDetailWidget': widget('easy_widgets.NewsDetailWidget', {}, { status: 'ready', item: { title: 'Example article', content: '<p>Detailed article content for the preview.</p>' } }),
    'easy_widgets.TopNewsPlugWidget': widget('easy_widgets.TopNewsPlugWidget', { layout: '1x2' }, { status: 'ready', items: news }),
    'easy_widgets.SidebarTopNewsWidget': widget('easy_widgets.SidebarTopNewsWidget', { widget_title: 'Top news' }, { status: 'ready', items: news }),
    'easy_widgets.SectionWidget': widget('easy_widgets.SectionWidget', { enableCollapse: false, slots: { content: [widget('easy_widgets.ContentWidget', { content: '<p>Nested section content.</p>' })] } }),
}

export const getRenderFixture = (type: string, id?: string): RenderWidgetModel | null => {
    const fixture = RENDER_WIDGET_FIXTURES[type]
    return fixture ? structuredClone({ ...fixture, id: id || fixture.id }) : null
}
