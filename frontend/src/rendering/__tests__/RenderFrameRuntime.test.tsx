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
    it('binds catalog targets to rendered DOM while keeping editor chrome out', async () => {
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace, viewId: 'page-main', themeCss: '.content-widget{color:rgb(1,2,3)}' }))

        const heading = await screen.findByRole('heading', { name: 'Overridden heading' })
        await waitFor(() => expect((heading as HTMLElement).contentEditable).toBe('true'))
        expect(heading).toHaveAttribute('data-designer-target', 'heading')
        expect(document.querySelector('[data-designer-target="article"]')).toBeTruthy()
        expect(document.querySelector('[data-designer-target="layout:main_layout:slot:main"]')).toBeTruthy()
        expect(document.querySelector('.page-editor-widget,.widget-header')).toBeNull()
        expect([...document.querySelectorAll('style')].some((style) => style.textContent?.includes('rgb(1,2,3)'))).toBe(true)
    })

    it('reports selection and content changes and shows spacing guides', async () => {
        const postMessage = vi.spyOn(window, 'postMessage')
        render(<RenderFrameRuntime />)
        sendModel(createDesignerRenderModel({ workspace, viewId: 'page-main' }))
        const heading = await screen.findByRole('heading', { name: 'Overridden heading' })

        fireEvent.mouseOver(heading)
        expect(document.querySelector('.designer-spacing-readout')).toBeTruthy()
        fireEvent.click(heading)
        fireEvent.input(heading, { target: { textContent: 'Edited heading' } })

        await waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'select', targetId: 'heading',
            computedStyles: expect.objectContaining({ fontSize: expect.any(String), marginBottom: expect.any(String) }),
        }), '*'))
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            source: 'eceee-designer-preview', action: 'contentChange', targetId: 'heading',
        }), '*')
        postMessage.mockRestore()
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
})
