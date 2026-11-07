import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorialListRender, EditorialDetailRender, editorialFeedUrl } from '../EditorialRender'
const context = { preview: false, siteId: '249' }
const renderWidgets = vi.fn(widgets => <div>{widgets.map((w: any) => <div key={w.id}>{w.config.content}</div>)}</div>)
const widget = { id: 'directory', type: 'object_storage.ObjectListWidget', config: { displayTemplate: 'columnists', limit: 50 }, data: { status: 'ready' as const, items: [{ id: 9, title: 'Jane', slug: 'jane', data: { introduction: 'Old biography', affiliation: 'Institute', prefix: 'Researcher', homePage: 'https://example.org', latestColumn: { title: 'A new column', slug: 'new-column' }, featuredImage: { url: '/jane.jpg', width: 300, height: 400 } } }] } }
afterEach(() => vi.unstubAllGlobals())
describe('editorial pages', () => {
    it('shows name, portrait and requested metadata instead of the biography', () => {
        render(<EditorialListRender widget={widget} context={context} renderWidgets={renderWidgets} />)
        expect(screen.getByRole('link', { name: 'Jane' })).toHaveAttribute('href', '/columnists/jane/')
        expect(screen.getByText('Institute')).toBeInTheDocument()
        expect(screen.getByText('Researcher')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'A new column' })).toHaveAttribute('href', '/news/new-column/')
        expect(screen.getByRole('link', { name: 'example.org' })).toHaveAttribute('href', 'https://example.org/')
        expect(screen.queryByText('Old biography')).not.toBeInTheDocument()
        expect(document.querySelector('img')).toHaveAttribute('src', '/jane.jpg')
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
    it('hides the directory on detail pages and the dynamic detail on the index', () => {
        const { container } = render(<><EditorialListRender widget={widget} context={{ ...context, pathVariables: { memberSlug: 'jane' } }} renderWidgets={renderWidgets} /><EditorialDetailRender widget={{ ...widget, type: 'object_storage.ObjectDetailWidget' }} context={context} renderWidgets={renderWidgets} /></>)
        expect(container).toBeEmptyDOMElement()
    })
    it('resolves both editor and public slug casing in the published detail URL', () => {
        expect(editorialFeedUrl(widget, { ...context, pathVariables: { memberSlug: 'jane' } }, true)).toContain('slug=jane')
        expect(editorialFeedUrl(widget, { ...context, pathVariables: { member_slug: 'jane' } }, true)).toContain('slug=jane')
        expect(editorialFeedUrl(widget, context, true)).toBeNull()
    })
    it('shows event dates, venue and the published description without raw field names', () => {
        render(<EditorialDetailRender widget={{ ...widget, config: { displayTemplate: 'events' }, data: { status: 'ready', item: { id: 10, title: 'Conference', data: { eventStartDate: '2027-06-01', venue: 'Stockholm' }, widgets: { main: [{ id: 'body', type: 'easy_widgets.ContentWidget', config: { content: '<h1>Conference</h1><p>Event description</p>' } }] } } } }} context={{ ...context, pathVariables: { event_slug: 'conference' } }} renderWidgets={renderWidgets} />)
        expect(screen.getByRole('heading', { name: 'Conference' })).toBeInTheDocument()
        expect(screen.getByText('Stockholm')).toBeInTheDocument()
        expect(screen.getByText('<p>Event description</p>')).toBeInTheDocument()
        expect(screen.queryByText('eventStartDate')).not.toBeInTheDocument()
    })
    it('keeps the profile biography and portrait beside a separate metadata column', () => {
        const { container } = render(<EditorialDetailRender widget={{ ...widget, config: { displayTemplate: 'columnists' }, data: { status: 'ready', item: { id: 9, title: 'Jane', data: widget.data.items[0].data,
            widgets: { main: [{ id: 'bio', type: 'easy_widgets.ContentWidget', config: { content: 'Profile biography' } }] } } } }} context={{ ...context, pathVariables: { member_slug: 'jane' } }} renderWidgets={renderWidgets} />)
        expect(container.querySelector('.editorial-profile-presentation')).toHaveTextContent('Profile biography')
        expect(container.querySelector('.editorial-profile-photo img')).toBeInTheDocument()
        expect(screen.getByRole('complementary', { name: 'About the columnist' })).toHaveTextContent('Institute')
        expect(screen.getByRole('link', { name: 'A new column' })).toBeInTheDocument()
    })
    it('passes the published object theme definitions to nested detail rendering', () => {
        const definitions = { version: 1 as const, items: [] }
        const nestedRenderer = vi.fn(() => <p>Published themed body</p>)
        render(<EditorialDetailRender widget={{ ...widget, config: { displayTemplate: 'events' }, data: { status: 'ready', item: { id: 9, title: 'Event', data: {}, themeWidgetTypes: definitions,
            widgets: { main: [{ id: 'themed', type: 'theme_widgets.profile-card', typeVersion: 1, config: {} }] } } } }} context={{ ...context, pathVariables: { event_slug: 'event' } }} renderWidgets={nestedRenderer} />)
        expect(nestedRenderer).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ type: 'theme_widgets.profile-card', typeVersion: 1 })]), definitions)
    })
    it('stops pagination at the last real item and keeps loaded content on failure', async () => {
        const items = Array.from({ length: 12 }, (_, i) => ({ id: i, title: `Writer ${i}`, slug: `writer-${i}`, data: {} }))
        const fetchMore = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
        vi.stubGlobal('fetch', fetchMore)
        render(<EditorialListRender widget={{ ...widget, data: { status: 'ready', items } }} context={context} renderWidgets={renderWidgets} />)
        fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument())
        expect(screen.getAllByRole('article')).toHaveLength(12)
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
        await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument())
        expect(screen.getAllByRole('article')).toHaveLength(12)
    })
    it('advances the server offset when a moving list repeats an entire batch', async () => {
        const items = Array.from({ length: 12 }, (_, id) => ({ id, title: `Writer ${id}`, slug: `writer-${id}`, data: {} }))
        const fetchMore = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ items }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
        vi.stubGlobal('fetch', fetchMore)
        render(<EditorialListRender widget={{ ...widget, data: { status: 'ready', items } }} context={context} renderWidgets={renderWidgets} />)
        fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Load more' })).toBeEnabled())
        fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
        await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument())
        expect(new URL(fetchMore.mock.calls[1][0]).searchParams.get('offset')).toBe('24')
        expect(screen.getAllByRole('article')).toHaveLength(12)
    })

})
