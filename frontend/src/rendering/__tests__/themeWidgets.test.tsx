import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThemeWidgetRender } from '../ThemeWidgetRender'
import { PageRenderer } from '../PageRenderer'
import { createPageRenderModel } from '../adapters'
import { themeWidgetTypes } from '../themeWidgets'
import { isWidgetAllowedInSlot } from '../../utils/widgetSlotPolicy'

const id = '2bf85f1b-26cc-4801-8cfa-bb680f93e256'
const type = `theme_widgets.${id}`
const release = (version: number) => ({ version, schema: { type: 'object', properties: { personName: { type: 'string' } } }, defaults: {},
    template: `<article class="person-v${version}"><h2>{{personName}}</h2></article>`, css: '', compiled_css: '' })
const document = { version: 1, items: [{ id, name: 'Person card', active_version: 2, releases: [release(1), release(2)] }] }

describe('Theme widget rendering', () => {
    it('renders a derived built-in container while keeping its identity for slot policy matching', () => {
        const derivedId = '62b20cc6-d904-4118-a9b4-c1addf4479e6'
        const derivedType = `theme_widgets.${derivedId}`
        const derivedDocument = { version: 1, items: [{ id: derivedId, name: 'Article columns', active_version: 1,
            releases: [{ version: 1, kind: 'derived' as const, base_type: 'easy_widgets.TwoColumnsWidget',
                base_version: null, defaults: {}, slot_policies: { left: { mode: 'allow' as const, allowed_widget_types: ['easy_widgets.HeadlineWidget'] } } }] }] }
        const model = createPageRenderModel({ layout: 'main_layout', context: { themeWidgetTypes: derivedDocument },
            widgets: { main: [{ id: 'article-columns', type: derivedType, type_version: 1, config: { slots: {
                left: [{ id: 'heading', type: 'easy_widgets.HeadlineWidget', config: { content: 'Inside' } }], right: [],
            } } }] } })
        const { container } = render(<PageRenderer model={model} />)
        expect(container.querySelector(`[data-widget-type="${derivedType}"]`)).not.toBeNull()
        expect(screen.getByText('Inside')).toBeInTheDocument()
        expect(isWidgetAllowedInSlot(derivedType, { widget_policy: { mode: 'allow', allowed_widget_types: [derivedType] } })).toBe(true)
        expect(isWidgetAllowedInSlot('easy_widgets.TwoColumnsWidget', { widget_policy: { mode: 'allow', allowed_widget_types: [derivedType] } })).toBe(false)
    })
    it('pins a derived theme widget to the exact base release', () => {
        const derivedId = '62b20cc6-d904-4118-a9b4-c1addf4479e6'
        const derivedType = `theme_widgets.${derivedId}`
        const derivedDocument = { ...document, items: [...document.items, { id: derivedId, name: 'Derived card', active_version: 1,
            releases: [{ version: 1, kind: 'derived' as const, base_type: type, base_version: 1, defaults: {}, slot_policies: {} }] }] }
        const { container } = render(<ThemeWidgetRender widget={{ id: 'derived', type: derivedType, typeVersion: 1, config: { personName: 'Pinned' } }}
            context={{ preview: false, themeWidgetTypes: derivedDocument }} renderWidgets={() => null} />)
        expect(container.querySelector('.person-v1')).toHaveTextContent('Pinned')
        expect(container.querySelector('.person-v2')).toBeNull()
    })
    it('renders the pinned release while new selections use the active release', () => {
        const { container } = render(<ThemeWidgetRender widget={{ id: 'person', type, typeVersion: 1, config: { personName: 'Alex' } }} context={{ preview: false, themeWidgetTypes: document }} renderWidgets={() => null} />)
        expect(container.querySelector('.person-v1')).not.toBeNull()
        expect(container.querySelector('.person-v2')).toBeNull()
        expect(screen.getByRole('heading', { name: 'Alex' })).toBeInTheDocument()
        expect(themeWidgetTypes(document)[0].typeVersion).toBe(2)
    })
    it('does not fall back to active when the pinned release is absent', () => {
        render(<ThemeWidgetRender widget={{ id: 'person', type, typeVersion: 3, config: { personName: 'Alex' } }} context={{ preview: true, themeWidgetTypes: document }} renderWidgets={() => null} />)
        expect(screen.getByText(/Missing widget revision/)).toBeInTheDocument()
        expect(screen.queryByRole('heading')).toBeNull()
    })
    it('preserves the version through page adapters and nested container rendering', () => {
        const model = createPageRenderModel({ layout: 'main_layout', widgets: { main: [{ id: 'columns', type: 'easy_widgets.TwoColumnsWidget', config: { slots: { left: [{ id: 'person', type, type_version: 1, config: { personName: 'Nested Alex' } }] } } }] }, context: { themeWidgetTypes: document } })
        const { container } = render(<PageRenderer model={model} />)
        expect(container.querySelector('.person-v1')).not.toBeNull()
        expect(screen.getByRole('heading', { name: 'Nested Alex' })).toBeInTheDocument()
    })
    it.each(['object_storage.ObjectDetailWidget', 'easy_widgets.NewsDetailWidget'])('uses object definitions inside %s without replacing page definitions', detailType => {
        const pageTypes = structuredClone(document)
        pageTypes.items[0].releases[0].template = '<p class="page-definition">Page: {{personName}}</p>'
        const objectTypes = structuredClone(document)
        objectTypes.items[0].releases[0].template = '<p class="object-definition">Object: {{personName}}</p>'
        const model = createPageRenderModel({
            layout: 'main_layout',
            context: { themeWidgetTypes: pageTypes },
            widgets: { main: [
                { id: 'page-person', type, type_version: 1, config: { personName: 'Page Alice' } },
                { id: 'detail', type: detailType, config: {}, data: { status: 'ready', item: {
                    id: 'object-1', title: 'Object', objectType: { name: 'article', label: 'Article' },
                    data: {}, theme_widget_types: objectTypes,
                    widgets: { main: [{ id: 'columns', type: 'easy_widgets.TwoColumnsWidget', config: { slots: {
                        left: [{ id: 'object-person', type, type_version: 1, config: { personName: 'Object Bob' } }],
                    } } }] },
                } } },
            ] },
        })
        const { container } = render(<PageRenderer model={model} />)
        expect(container.querySelector('.page-definition')).toHaveTextContent('Page: Page Alice')
        expect(container.querySelector('.object-definition')).toHaveTextContent('Object: Object Bob')
        expect(container.querySelectorAll('.page-definition')).toHaveLength(1)
    })
    it('sanitizes raw template substitutions and exposes only schema-defined fields', () => {
        const unsafe = structuredClone(document)
        unsafe.items[0].releases[0].template = '<p>{{{personName}}}{{secret}}</p>'
        const { container } = render(<ThemeWidgetRender widget={{ id: 'person', type, typeVersion: 1, config: { personName: '<img src="x" onerror="alert(1)"><script>bad()</script>', secret: 'HIDDEN' } }} context={{ preview: true, themeWidgetTypes: unsafe }} renderWidgets={() => null} />)
        expect(container.querySelector('script')).toBeNull()
        expect(container.querySelector('[onerror]')).toBeNull()
        expect(container.textContent).not.toContain('HIDDEN')
    })
    it('archival hides new selections but preserves pinned rendering', () => {
        const archived = { ...document, items: document.items.map(item => ({ ...item, status: 'archived' as const })) }
        expect(themeWidgetTypes(archived)).toEqual([])
        render(<ThemeWidgetRender widget={{ id: 'person', type, typeVersion: 1, config: { personName: 'Archived Alex' } }} context={{ preview: true, themeWidgetTypes: archived }} renderWidgets={() => null} />)
        expect(screen.getByRole('heading', { name: 'Archived Alex' })).toBeInTheDocument()
    })
})
