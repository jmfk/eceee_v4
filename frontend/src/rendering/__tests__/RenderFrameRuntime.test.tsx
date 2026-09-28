import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RenderFrameRuntime from '../RenderFrameRuntime'
import { createDesignerRenderModel, createPageRenderModel } from '../adapters'

const workspace = {
    previewContent: { views: [{ id: 'page-main', layout: 'main_layout', texts: { heading: 'Overridden heading' }, images: {} }] },
    catalog: {
        layouts: [{ key: 'main_layout', slots: [{ name: 'main', label: 'Main content' }] }],
        componentStyles: [],
        designGroups: [{
            id: 'article', label: 'Article', widgetTypes: ['easy_widgets.ContentWidget'], slots: ['main'],
            parts: [{ id: 'article-body', part: 'content-widget', label: 'Body' }],
            elements: [{ id: 'heading', element: 'h1', label: 'Heading' }],
            assetKeys: [],
        }],
    },
    assets: [],
}

const sendModel = (model: ReturnType<typeof createDesignerRenderModel>) => act(() => {
    window.dispatchEvent(new MessageEvent('message', {
        source: window,
        data: { source: 'eceee-render-host', action: 'render', model },
    }))
})

describe('RenderFrameRuntime navigation', () => {
    it('rewrites and forwards internal standalone-preview navigation', async () => {
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createPageRenderModel({
            widgets: { main: [{
                id: 'nav',
                type: 'easy_widgets.NavigationWidget',
                config: { menuItems: [{ label: 'Publication ethics', url: '/for-authors/publication-ethics/' }] },
            }] },
            context: {
                renderRoutePrefix: '/_render/85',
                simulatedPath: '/for-authors/review-process/',
                siteHostnames: ['summerstudy.localhost'],
            },
        }))

        const link = await screen.findByRole('link', { name: 'Publication ethics' })
        expect(link).toHaveAttribute('href', '/_render/85/for-authors/publication-ethics/')
        fireEvent.click(link)
        expect(postMessage).toHaveBeenCalledWith({
            source: 'eceee-render-frame',
            action: 'navigate',
            href: '/_render/85/for-authors/publication-ethics/',
        }, '*')
        postMessage.mockRestore()
    })

    it('continues to block links in editor and designer previews', async () => {
        render(<RenderFrameRuntime />)
        sendModel(createPageRenderModel({
            widgets: { main: [{
                id: 'nav',
                type: 'easy_widgets.NavigationWidget',
                config: { menuItems: [{ label: 'Blocked', url: '/blocked/' }] },
            }] },
        }))

        const link = await screen.findByRole('link', { name: 'Blocked' })
        const click = new MouseEvent('click', { bubbles: true, cancelable: true })
        link.dispatchEvent(click)
        expect(click.defaultPrevented).toBe(true)
    })
})

describe('RenderFrameRuntime designer overlay', () => {
    it('binds read-only catalog targets to rendered DOM while keeping editor chrome out', async () => {
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace, viewId: 'page-main', themeCss: '.content-widget{color:rgb(1,2,3)}' }))

        const heading = await screen.findByRole('heading', { name: 'Overridden heading' })
        await waitFor(() => expect(heading).toHaveAttribute('data-designer-target', 'heading'))
        expect((heading as HTMLElement).contentEditable).not.toBe('true')
        expect(heading).toHaveAttribute('data-designer-target', 'heading')
        expect(document.querySelector('[data-designer-target="article"]')).toBeTruthy()
        expect(document.querySelector('[data-designer-target="layout:main_layout:slot:main"]')).toBeTruthy()
        expect(document.querySelector('.page-editor-widget,.widget-header')).toBeNull()
        expect([...document.querySelectorAll('style')].some((style) => style.textContent?.includes('rgb(1,2,3)'))).toBe(true)
    })

    it('gives each visible text element its own editable example target', async () => {
        const editableWorkspace = structuredClone(workspace)
        editableWorkspace.previewContent.views[0].texts = { 'content:0': 'Saved example heading' }
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace: editableWorkspace, viewId: 'page-main', contentEditable: true }))

        const heading = await screen.findByRole('heading', { name: 'Saved example heading' })
        expect(heading).toHaveAttribute('data-designer-target', 'content:0')
        expect((heading as HTMLElement).contentEditable).toBe('true')
        fireEvent.input(heading, { target: { textContent: 'Changed example heading' } })

        await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview',
            action: 'contentChange',
            targetId: 'content:0',
            label: 'Heading 1 text',
            editable: true,
        }), '*'))

        act(() => window.dispatchEvent(new MessageEvent('message', {
            source: window,
            data: { source: 'eceee-render-host', action: 'updateText', targetId: 'content:0', text: 'Inspector update' },
        })))
        expect(heading).toHaveTextContent('Inspector update')
        postMessage.mockRestore()
    })

    it('makes unconfigured visible text editable without making live content editable', async () => {
        const unconfiguredWorkspace = {
            ...structuredClone(workspace),
            previewContent: { views: [{
                id: 'plain-page', layout: 'main_layout', texts: {},
                content: { widgets: { main: [{ id: 'plain', type: 'easy_widgets.ContentWidget', config: { content: '<p>Plain copied text</p>' } }] } },
            }] },
            catalog: { ...structuredClone(workspace.catalog), designGroups: [] },
        }
        const { unmount } = render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace: unconfiguredWorkspace, viewId: 'plain-page', contentEditable: true }))

        const editableParagraph = await screen.findByText('Plain copied text')
        expect(editableParagraph).toHaveAttribute('data-designer-target', 'content:0')
        expect((editableParagraph as HTMLElement).contentEditable).toBe('true')

        unmount()
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace: unconfiguredWorkspace, viewId: 'plain-page', contentEditable: false }))
        const readOnlyParagraph = await screen.findByText('Plain copied text')
        expect(readOnlyParagraph).not.toHaveAttribute('data-designer-target')
        expect((readOnlyParagraph as HTMLElement).contentEditable).not.toBe('true')
    })

    it('requires an explicit editable flag for render models outside the Designer adapter', async () => {
        const model = createDesignerRenderModel({ workspace, viewId: 'page-main', contentEditable: true })
        delete model.designer?.contentEditable
        render(<RenderFrameRuntime />)
        sendModel(model)

        const heading = await screen.findByRole('heading', { name: 'Overridden heading' })
        await waitFor(() => expect(heading).toHaveAttribute('data-designer-target', 'heading'))
        expect(heading).not.toHaveAttribute('data-designer-target', 'content:0')
        expect((heading as HTMLElement).contentEditable).not.toBe('true')
    })

    it('uses one non-overlapping editable target for nested text markup', async () => {
        const nestedWorkspace = {
            ...structuredClone(workspace),
            previewContent: { views: [{
                id: 'nested-page', layout: 'main_layout', texts: {},
                content: { widgets: { main: [{
                    id: 'nested', type: 'easy_widgets.ContentWidget',
                    config: { content: '<h3><a href="#details">Linked heading</a></h3>' },
                }] } },
            }] },
            catalog: { ...structuredClone(workspace.catalog), designGroups: [] },
        }
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace: nestedWorkspace, viewId: 'nested-page', contentEditable: true }))

        const link = await screen.findByRole('link', { name: 'Linked heading' })
        const heading = link.closest('h3')!
        expect(link).toHaveAttribute('data-designer-target', 'content:0')
        expect((link as HTMLElement).contentEditable).toBe('true')
        expect((heading as HTMLElement).contentEditable).not.toBe('true')

        postMessage.mockClear()
        link.textContent = 'Changed link'
        Object.defineProperty(link, 'innerText', { configurable: true, value: 'Changed link' })
        fireEvent.input(link)
        const changes = postMessage.mock.calls.filter(([message]) => message?.action === 'contentChange')
        expect(changes).toHaveLength(1)
        expect(changes[0][0]).toEqual(expect.objectContaining({ targetId: 'content:0', text: 'Changed link' }))
        expect(heading.querySelector('a')).toBe(link)
        postMessage.mockRestore()
    })

    it('reports selection without content changes and shows spacing guides', async () => {
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({
            workspace,
            viewId: 'page-main',
            themeCss: 'h1{margin:10px 20px 30px 40px;padding:5px 6px 7px 8px;border:2px solid transparent}',
        }))
        const heading = await screen.findByRole('heading', { name: 'Overridden heading' })
        vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue({
            x: 80, y: 100, left: 80, top: 100, right: 380, bottom: 300, width: 300, height: 200,
            toJSON: () => ({}),
        })

        fireEvent.mouseOver(heading)
        expect(document.querySelector('.designer-spacing-readout')).toBeNull()
        expect(document.querySelector('.designer-spacing-margin-value[data-side="top"]')).toHaveTextContent('10px')
        expect(document.querySelector('.designer-spacing-margin-value[data-side="top"]')).toHaveAttribute('data-placement', 'outside')
        expect(document.querySelector('.designer-spacing-margin-value[data-side="top"]')).toHaveStyle({ left: '220px', top: '80px' })
        expect(document.querySelector('.designer-spacing-margin-value[data-side="bottom"]')).toHaveTextContent('30px')
        expect(document.querySelector('.designer-spacing-margin-value[data-side="bottom"]')).toHaveStyle({ left: '220px', top: '315px' })
        expect(document.querySelector('.designer-spacing-padding-value[data-side="left"]')).toHaveTextContent('8px')
        expect(document.querySelector('.designer-spacing-padding-value[data-side="left"]')).toHaveAttribute('data-placement', 'outside')
        expect(document.querySelector('.designer-spacing-padding-value[data-side="left"]')).toHaveStyle({ left: '69px', top: '199px' })
        expect(document.querySelector('.designer-spacing-margin-measure[data-side="top"]')).toHaveStyle({
            left: '220px', top: '90px', height: '10px',
        })
        expect(document.querySelector('.designer-spacing-padding-measure[data-side="left"]')).toHaveStyle({
            left: '82px', top: '199px', width: '8px',
        })
        expect(heading).toHaveClass('designer-hovered')
        expect(document.querySelector('.designer-spacing-margin[data-side="bottom"]')).toHaveStyle({
            left: '40px', top: '300px', width: '360px', height: '30px',
        })
        expect(document.querySelector('.designer-spacing-padding[data-side="left"]')).toHaveStyle({
            left: '82px', top: '107px', width: '8px', height: '184px',
        })
        expect(document.querySelector('.designer-spacing-content')).toHaveStyle({
            left: '90px', top: '107px', width: '282px', height: '184px',
        })
        fireEvent.click(heading)

        await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'select', targetId: 'heading',
            computedStyles: expect.objectContaining({ fontSize: expect.any(String), marginBottom: expect.any(String) }),
        }), '*'))
        expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'contentChange', targetId: 'heading',
        }), '*')
        postMessage.mockRestore()
    })

    it('shows spacing for structural layout elements without designer targets', async () => {
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace, viewId: 'page-main' }))
        await screen.findByRole('heading', { name: 'Overridden heading' })
        const grid = document.querySelector<HTMLElement>('.main-layout-grid')!
        grid.style.padding = '30px 40px'
        vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({
            x: 0, y: 100, left: 0, top: 100, right: 600, bottom: 500, width: 600, height: 400,
            toJSON: () => ({}),
        })

        fireEvent.mouseOver(grid)

        expect(grid).not.toHaveAttribute('data-designer-target')
        expect(grid).toHaveClass('designer-hovered')
        expect(document.querySelector('.designer-spacing-padding[data-side="top"]')).toHaveStyle({
            left: '0px', top: '100px', width: '600px', height: '30px',
        })
        expect(document.querySelector('.designer-spacing-padding[data-side="left"]')).toHaveStyle({
            left: '0px', top: '130px', width: '40px', height: '340px',
        })
    })

    it('centers a spacing value in the visible part of an offscreen region', async () => {
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace, viewId: 'page-main' }))
        await screen.findByRole('heading', { name: 'Overridden heading' })
        const grid = document.querySelector<HTMLElement>('.main-layout-grid')!
        grid.style.paddingTop = '30px'
        vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({
            x: -200, y: 100, left: -200, top: 100, right: 300, bottom: 500, width: 500, height: 400,
            toJSON: () => ({}),
        })

        fireEvent.mouseOver(grid)

        expect(document.querySelector('.designer-spacing-padding-value[data-side="top"]')).toHaveTextContent('30px')
        expect(document.querySelector('.designer-spacing-padding-value[data-side="top"]')).toHaveStyle({
            left: '150px', top: '115px',
        })
    })

    it('keeps a tight spacing label on the true exterior side at a viewport edge', async () => {
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace, viewId: 'page-main' }))
        await screen.findByRole('heading', { name: 'Overridden heading' })
        const grid = document.querySelector<HTMLElement>('.main-layout-grid')!
        grid.style.paddingLeft = '20px'
        vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({
            x: 0, y: 100, left: 0, top: 100, right: 300, bottom: 300, width: 300, height: 200,
            toJSON: () => ({}),
        })

        fireEvent.mouseOver(grid)

        expect(document.querySelector('.designer-spacing-padding-value[data-side="left"]')).toHaveStyle({
            left: '12px', top: '200px',
        })
        expect(document.querySelector('.designer-spacing-padding-measure[data-side="left"]')).toHaveStyle({
            left: '0px', top: '200px', width: '20px',
        })
    })

    it('returns current computed theme values for a requested target', async () => {
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace, viewId: 'page-main' }))
        await screen.findByRole('heading', { name: 'Overridden heading' })

        act(() => window.dispatchEvent(new MessageEvent('message', {
            data: { source: 'eceee-render-host', action: 'readTargetStyles', targetId: 'heading' },
            source: window.parent,
        })))

        await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'targetStyles', targetId: 'heading',
            computedStyles: expect.objectContaining({ fontSize: expect.any(String), padding: expect.any(String) }),
        }), '*'))
        postMessage.mockRestore()
    })

    it('renders real page content as read-only and can hide support guides', async () => {
        const sourceModel = createPageRenderModel({
            widgets: { main: [{ id: 'real-content', type: 'easy_widgets.ContentWidget', config: { content: '<h1>Real page heading</h1>' } }] },
            context: { tenantId: 'theme-tenant', pageId: 42, versionId: 9 },
        })
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({
            workspace,
            viewId: 'page-main',
            sourceModel,
            guidesEnabled: false,
        }))

        const heading = await screen.findByRole('heading', { name: 'Real page heading' })
        await waitFor(() => expect(heading).toHaveAttribute('data-designer-target', 'heading'))
        expect((heading as HTMLElement).contentEditable).not.toBe('true')
        expect(document.querySelector('.designer-preview')).not.toHaveClass('designer-guides')
        fireEvent.mouseOver(heading)
        expect(document.querySelector('.designer-spacing-readout')).toBeNull()
    })

    it('renders copied object data without a live object', async () => {
        const objectWorkspace = {
            catalog: { layouts: [{ key: 'main_layout', slots: [{ name: 'main' }] }], componentStyles: [] },
            previewContent: { views: [{
                id: 'copied-object', kind: 'object', layout: 'main_layout',
                objectType: { schema: { properties: {
                    summary: { title: 'Summary' },
                    biography: { title: 'Biography', componentType: 'rich_text' },
                    portrait: { title: 'Portrait', componentType: 'image' },
                    tags: { title: 'Tags', type: 'array', items: { type: 'string' } },
                } } },
                content: { data: {
                    summary: 'Detached object body',
                    biography: '<p>Formatted <strong>biography</strong></p>',
                    portrait: { url: 'https://storage.test/portrait.jpg' },
                    tags: ['Research', 'Policy'],
                }, widgets: {} },
            }] },
        }
        render(<RenderFrameRuntime />)

        sendModel(createDesignerRenderModel({ workspace: objectWorkspace, viewId: 'copied-object' }))

        expect(await screen.findByText('Detached object body')).toBeInTheDocument()
        expect(screen.getByText('Summary')).toBeInTheDocument()
        expect(screen.getByText('biography', { selector: 'strong' })).toBeInTheDocument()
        expect(screen.getByRole('img', { name: 'Portrait' })).toHaveAttribute('src', 'https://storage.test/portrait.jpg')
        expect(screen.getByText('Research', { selector: 'li' })).toBeInTheDocument()
    })

    it('renders images imported into legacy site preview metadata', async () => {
        const imageWorkspace = {
            catalog: { layouts: [{ key: 'main_layout', slots: [{ name: 'hero' }, { name: 'main' }] }], componentStyles: [], designGroups: [] },
            previewContent: { views: [{
                id: 'site-page', layout: 'main_layout', texts: {},
                images: { 'preview:site-page:image:hero': { url: 'https://storage.test/site-hero.jpg', filename: 'Site hero' } },
            }] },
        }
        render(<RenderFrameRuntime />)

        sendModel(createDesignerRenderModel({ workspace: imageWorkspace, viewId: 'site-page' }))

        expect(await screen.findByRole('img', { name: 'Site hero' })).toHaveAttribute('src', 'https://storage.test/site-hero.jpg')
    })
})
