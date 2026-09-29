import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    typography: [{ targetId: 'article-body', values: { fontSize: '16px' } }],
    spacing: [{ targetId: 'heading', values: { marginTop: '10px', marginBottom: '30px', paddingLeft: '8px' } }],
    constraints: { editableTypographyProperties: ['fontSize'], editableSpacingProperties: ['marginTop', 'marginBottom', 'paddingLeft'] },
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

    it('edits a rich text field as one sanitized HTML value after double-click', async () => {
        const editableWorkspace = structuredClone(workspace)
        editableWorkspace.previewContent.views[0].texts = { 'content:0': '<h1>Saved example heading</h1>' }
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace: editableWorkspace, viewId: 'page-main', contentEditable: true }))

        const heading = await screen.findByRole('heading', { name: 'Saved example heading' })
        const richText = heading.closest('.content-widget') as HTMLElement
        expect(richText).toHaveAttribute('data-designer-target', 'content:0')
        expect(richText.contentEditable).not.toBe('true')
        fireEvent.doubleClick(heading)
        expect(richText.contentEditable).toBe('true')
        heading.textContent = 'Changed example heading'
        fireEvent.input(richText)

        await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview',
            action: 'contentChange',
            targetId: 'content:0',
            label: 'Rich text',
            editable: true,
            richText: true,
        }), '*'))

        act(() => window.dispatchEvent(new MessageEvent('message', {
            source: window,
            data: { source: 'eceee-render-host', action: 'updateText', targetId: 'content:0', text: '<h2>Inspector update</h2>' },
        })))
        expect(richText.querySelector('h2')).toHaveTextContent('Inspector update')
        postMessage.mockRestore()
    })

    it('opens element actions at the pointer and starts inline text editing', async () => {
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace, viewId: 'page-main', contentEditable: true }))

        const heading = await screen.findByRole('heading', { name: 'Overridden heading' })
        const richText = heading.closest('.content-widget') as HTMLElement
        const focus = vi.spyOn(richText, 'focus')
        fireEvent.contextMenu(heading, { clientX: 48, clientY: 64 })

        const menu = screen.getByRole('menu', { name: 'Actions for Heading' })
        expect(menu).toHaveStyle({ left: '48px', top: '64px' })
        expect(within(menu).getByRole('menuitem', { name: 'Edit text' })).toBeInTheDocument()
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Edit text' }))

        expect(focus).toHaveBeenCalled()
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview',
            action: 'editText',
            targetId: 'content:0',
        }), '*')
        postMessage.mockRestore()
    })

    it('runs rich text toolbar commands against the active field', async () => {
        const execCommand = vi.fn()
        Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace, viewId: 'page-main', contentEditable: true }))
        const heading = await screen.findByRole('heading', { name: 'Overridden heading' })
        const richText = heading.closest('.content-widget') as HTMLElement
        fireEvent.doubleClick(heading)

        act(() => window.dispatchEvent(new MessageEvent('message', {
            source: window,
            data: { source: 'eceee-render-host', action: 'formatText', targetId: 'content:0', command: 'bold' },
        })))
        act(() => window.dispatchEvent(new MessageEvent('message', {
            source: window,
            data: { source: 'eceee-render-host', action: 'formatText', targetId: 'content:0', command: 'formatBlock', value: 'h2' },
        })))

        expect(execCommand).toHaveBeenCalledWith('bold', false, undefined)
        expect(execCommand).toHaveBeenCalledWith('formatBlock', false, '<h2>')
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ action: 'contentChange', targetId: 'content:0', richText: true }), '*')
        expect(richText.contentEditable).toBe('true')
        delete (document as any).execCommand
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
        const richText = editableParagraph.closest('.content-widget') as HTMLElement
        expect(richText).toHaveAttribute('data-designer-target', 'content:0')
        expect(richText.contentEditable).not.toBe('true')
        fireEvent.doubleClick(editableParagraph)
        expect(richText.contentEditable).toBe('true')

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
        const richText = link.closest('.content-widget') as HTMLElement
        expect(richText).toHaveAttribute('data-designer-target', 'content:0')
        expect(richText.contentEditable).not.toBe('true')
        expect((heading as HTMLElement).contentEditable).not.toBe('true')

        postMessage.mockClear()
        fireEvent.doubleClick(link)
        expect(richText.contentEditable).toBe('true')
        link.textContent = 'Changed link'
        Object.defineProperty(link, 'innerText', { configurable: true, value: 'Changed link' })
        fireEvent.input(richText)
        const changes = postMessage.mock.calls.filter(([message]) => message?.action === 'contentChange')
        expect(changes).toHaveLength(1)
        expect(changes[0][0]).toEqual(expect.objectContaining({ targetId: 'content:0', text: expect.stringContaining('Changed link'), richText: true }))
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
        let headingRect = {
            x: 80, y: 100, left: 80, top: 100, right: 380, bottom: 300, width: 300, height: 200,
            toJSON: () => ({}),
        }
        vi.spyOn(heading, 'getBoundingClientRect').mockImplementation(() => headingRect)

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
        fireEvent.click(screen.getByRole('button', { name: 'Edit margin top' }))
        const spacingInput = screen.getByLabelText('margin top value')
        const spacingEditor = screen.getByRole('form', { name: 'Edit margin top' })
        expect(window.getComputedStyle(spacingEditor).zIndex).toBe('2147483647')
        expect(window.getComputedStyle(document.querySelector('.designer-spacing-measure')! as HTMLElement).zIndex).toBe('2147483645')
        expect(spacingEditor).toHaveStyle({ top: '92px' })
        fireEvent.keyDown(spacingInput, { key: 'ArrowUp' })
        expect(spacingInput).toHaveValue('11px')
        fireEvent.keyDown(spacingInput, { key: 'ArrowDown', shiftKey: true })
        expect(spacingInput).toHaveValue('1px')

        headingRect = { ...headingRect, y: 140, top: 140, bottom: 340 }
        fireEvent.scroll(window)
        expect(spacingEditor).toHaveStyle({ top: '132px' })

        fireEvent.change(spacingInput, { target: { value: '18px' } })
        fireEvent.keyDown(spacingInput, { key: 'Enter' })
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'spacingChange', property: 'marginTop', value: '18px',
            targetIds: expect.arrayContaining(['heading']), viewportWidth: window.innerWidth,
        }), '*')
        expect(screen.queryByRole('form', { name: 'Edit margin top' })).not.toBeInTheDocument()

        const appliedChanges = () => postMessage.mock.calls.filter(([message]) => message?.action === 'spacingChange')
        fireEvent.click(screen.getByRole('button', { name: 'Edit margin top' }))
        fireEvent.change(screen.getByLabelText('margin top value'), { target: { value: '19px' } })
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        expect(appliedChanges().at(-1)?.[0]).toEqual(expect.objectContaining({ value: '19px' }))

        const appliedCount = appliedChanges().length
        fireEvent.click(screen.getByRole('button', { name: 'Edit margin top' }))
        fireEvent.change(screen.getByLabelText('margin top value'), { target: { value: '20px' } })
        fireEvent.keyDown(screen.getByLabelText('margin top value'), { key: 'Escape' })
        expect(screen.queryByRole('form', { name: 'Edit margin top' })).not.toBeInTheDocument()
        expect(appliedChanges()).toHaveLength(appliedCount)

        fireEvent.click(screen.getByRole('button', { name: 'Edit margin top' }))
        fireEvent.change(screen.getByLabelText('margin top value'), { target: { value: '21px' } })
        fireEvent.pointerDown(document.body)
        expect(screen.queryByRole('form', { name: 'Edit margin top' })).not.toBeInTheDocument()
        expect(appliedChanges()).toHaveLength(appliedCount)

        fireEvent.click(screen.getByRole('button', { name: 'Edit margin top' }))
        fireEvent.change(screen.getByLabelText('margin top value'), { target: { value: '22px' } })
        fireEvent.blur(window)
        expect(screen.queryByRole('form', { name: 'Edit margin top' })).not.toBeInTheDocument()
        expect(appliedChanges()).toHaveLength(appliedCount)
        headingRect = { ...headingRect, y: 100, top: 100, bottom: 300 }
        fireEvent.scroll(window)
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
            ancestors: expect.arrayContaining([expect.objectContaining({ id: 'article-body' })]),
        }), '*'))
        expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'contentChange', targetId: 'heading',
        }), '*')

        postMessage.mockClear()
        fireEvent(window, new MessageEvent('message', {
            data: { source: 'eceee-render-host', action: 'selectTarget', targetId: 'heading' },
            source: window.parent,
        }))
        await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'select', targetId: 'heading',
            alternatives: expect.any(Array), ancestors: expect.any(Array), descendants: expect.any(Array),
        }), '*'))
        fireEvent.mouseOut(heading, { relatedTarget: document.body })
        expect(heading).toHaveClass('designer-selected')
        expect(heading).toHaveClass('designer-hovered')
        expect(document.querySelector('.designer-spacing-margin-value[data-side="top"]')).toHaveTextContent('10px')
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

    it('identifies the exact repeated image imported into legacy site preview metadata', async () => {
        const imageWorkspace = {
            catalog: { layouts: [{ key: 'main_layout', slots: [{ name: 'hero' }, { name: 'main' }] }], componentStyles: [], designGroups: [] },
            previewContent: { views: [{
                id: 'site-page', layout: 'main_layout', texts: {},
                images: {
                    'preview:site-page:image:main': { url: '/theme_images/site-hero.jpg', filename: 'Site hero repeated' },
                    'preview:site-page:image:hero': { url: '/theme_images/site-hero.jpg', filename: 'Site hero' },
                },
            }] },
        }
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)

        sendModel(createDesignerRenderModel({ workspace: imageWorkspace, viewId: 'site-page', contentEditable: true }))

        const image = await screen.findByRole('img', { name: 'Site hero' })
        expect(image).toHaveAttribute('src', '/theme_images/site-hero.jpg')
        fireEvent.contextMenu(image, { clientX: 30, clientY: 40 })
        fireEvent.click(screen.getByRole('menuitem', { name: 'Replace image' }))
        const input = document.querySelector<HTMLInputElement>('input[type="file"][accept*="image/png"]')!
        const replacement = new File(['replacement'], 'replacement.png', { type: 'image/png' })
        fireEvent.change(input, { target: { files: [replacement] } })

        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview',
            action: 'contextAction',
            command: 'replaceImage',
            targetId: 'content-image:0',
            kind: 'previewImage',
            sourceUrl: '/theme_images/site-hero.jpg',
            sourceOccurrence: 1,
            sourcePath: ['images', 'preview:site-page:image:hero', 'url'],
            sourceMatchIndex: 0,
            file: replacement,
        }), '*')
        expect(input).not.toBeInTheDocument()
        postMessage.mockRestore()
    })
})
