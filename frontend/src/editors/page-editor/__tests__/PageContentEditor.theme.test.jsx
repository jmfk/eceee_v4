import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    useEditorThemeStyles: vi.fn(() => ({ error: null, scopeId: 'version-83' }))
}))

vi.mock('../../../hooks/useTheme', () => ({
    useEditorThemeStyles: mocks.useEditorThemeStyles
}))

vi.mock('../../../utils/defaultLayout', () => ({
    getDefaultLayout: vi.fn(() => Promise.resolve('main_layout'))
}))

vi.mock('../ReactLayoutRenderer', () => ({
    default: () => <div data-testid="layout-renderer" />
}))

import PageContentEditor from '../PageContentEditor'

describe('PageContentEditor theme settings', () => {
    beforeEach(() => {
        mocks.useEditorThemeStyles.mockClear()
    })

    it('uses live webpage CSS settings before saved version fallbacks', () => {
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
            pageCssVariables: { '--page-color': 'live' },
            pageCustomCss: '.live {}',
            enableCssInjection: false
        }))
    })

    it('falls back to version CSS settings when webpage fields are absent', () => {
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
            pageCssVariables: { '--page-color': 'saved' },
            pageCustomCss: '.saved {}',
            enableCssInjection: false
        }))
    })
})
