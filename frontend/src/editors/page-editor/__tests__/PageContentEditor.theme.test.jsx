import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    useEditorThemeStyles: vi.fn(() => ({ error: null, scopeId: 'version-83' })),
    rendererProps: vi.fn(),
}))

vi.mock('../../../hooks/useTheme', () => ({
    useEditorThemeStyles: mocks.useEditorThemeStyles
}))

vi.mock('../../../utils/defaultLayout', () => ({
    getDefaultLayout: vi.fn(() => Promise.resolve('main_layout'))
}))

vi.mock('../ReactLayoutRenderer', () => ({
    default: (props) => {
        mocks.rendererProps(props)
        return <div data-testid="layout-renderer" />
    }
}))

import PageContentEditor from '../PageContentEditor'

describe('PageContentEditor theme settings', () => {
    beforeEach(() => {
        mocks.useEditorThemeStyles.mockClear()
        mocks.rendererProps.mockClear()
    })

    it('passes page and version CSS separately to the canonical resolver', () => {
        render(
            <PageContentEditor
                currentVersion={{ id: 83 }}
                webpageData={{
                    pageCssVariables: { '--page-color': 'live' },
                    pageCustomCss: '.live {}',
                    enableCssInjection: false
                }}
                pageVersionData={{
                    pageCssVariables: { '--page-color': 'saved' },
                    pageCustomCss: '.saved {}',
                    enableCssInjection: true
                }}
            />
        )

        expect(mocks.useEditorThemeStyles).toHaveBeenLastCalledWith(expect.objectContaining({
            page: expect.objectContaining({ pageCustomCss: '.live {}', enableCssInjection: false }),
            version: expect.objectContaining({ pageCustomCss: '.saved {}', enableCssInjection: true })
        }))
    })

    it('passes an empty page separately from version CSS', () => {
        render(
            <PageContentEditor
                currentVersion={{ id: 83 }}
                webpageData={{}}
                pageVersionData={{
                    pageCssVariables: { '--page-color': 'saved' },
                    pageCustomCss: '.saved {}',
                    enableCssInjection: false
                }}
            />
        )

        expect(mocks.useEditorThemeStyles).toHaveBeenLastCalledWith(expect.objectContaining({
            page: {},
            version: expect.objectContaining({ pageCustomCss: '.saved {}', enableCssInjection: false })
        }))
    })

    it('passes the editor control visibility preference to the layout renderer', () => {
        render(
            <PageContentEditor
                currentVersion={{ id: 83 }}
                pageVersionData={{}}
                alwaysShowEditorControls={false}
            />
        )

        expect(mocks.rendererProps).toHaveBeenLastCalledWith(expect.objectContaining({
            alwaysShowEditorControls: false
        }))
    })
})
