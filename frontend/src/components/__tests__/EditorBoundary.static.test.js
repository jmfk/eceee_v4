import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(testDir, '../../..')

const readSource = path => readFileSync(resolve(repoRoot, path), 'utf8')

describe('page editor active/legacy boundaries', () => {
    it('keeps active React editor files off stale LayoutRenderer imperative APIs', () => {
        const activeFiles = [
            'src/components/PageEditor.jsx',
            'src/editors/page-editor/PageContentEditor.jsx',
            'src/editors/page-editor/ReactLayoutRenderer.jsx',
            'src/editors/page-editor/PageWidgetFactory.jsx'
        ]
        const forbiddenPatterns = [
            /\bexecuteWidgetDataCallback\b/,
            /\bgetSlotWidgetData\b/,
            /\blayoutRenderer\.updateWidget\b/,
            /\blayoutRenderer\?\.getLayoutContext\b/,
            /\bWIDGET_ACTIONS\b/,
            /from ['"][^'"]*\/ContentEditor(?:\.jsx)?['"]/
        ]

        for (const file of activeFiles) {
            const source = readSource(file)
            for (const pattern of forbiddenPatterns) {
                expect(source, `${file} should not match ${pattern}`).not.toMatch(pattern)
            }
        }
    })

    it('keeps migrated widgets parent-owned instead of direct UDC publishers', () => {
        const migratedWidgetFiles = [
            'src/widgets/easy-widgets/ContentWidget.jsx',
            'src/widgets/easy-widgets/HeadlineWidget.jsx',
            'src/widgets/easy-widgets/BannerWidget.jsx',
            'src/widgets/easy-widgets/HeroWidget.jsx',
            'src/widgets/easy-widgets/ContentCardWidget.jsx',
            'src/widgets/easy-widgets/BioWidget.jsx'
        ]
        const forbiddenPatterns = [
            /\bpublishUpdate\b/,
            /\bOperationTypes\b/,
            /UPDATE_WIDGET_CONFIG/
        ]

        for (const file of migratedWidgetFiles) {
            const source = readSource(file)
            for (const pattern of forbiddenPatterns) {
                expect(source, `${file} should not match ${pattern}`).not.toMatch(pattern)
            }
        }
    })

    it('keeps active prop-manager behavior behind the page editor prop adapter', () => {
        const pageWidgetFactorySource = readSource('src/editors/page-editor/PageWidgetFactory.jsx')
        const isolatedFormRendererSource = readSource('src/components/IsolatedFormRenderer.jsx')
        const adapterSource = readSource('src/utils/pageEditorPropAdapter.js')

        expect(pageWidgetFactorySource).toContain('createPageWidgetConfigChangeHandler')
        expect(pageWidgetFactorySource).not.toMatch(/onConfigChange\.length/)

        expect(isolatedFormRendererSource).toContain('buildWidgetPropUpdate')
        expect(isolatedFormRendererSource).toContain('shouldHydrateExternalWidgetProps')
        expect(isolatedFormRendererSource).not.toMatch(/sourceId\.startsWith\(['"]field-/)
        expect(isolatedFormRendererSource).not.toMatch(/sourceId\.startsWith\(['"]bannerwidget-/)
        expect(isolatedFormRendererSource).not.toMatch(/sourceId\.startsWith\(['"]widget-/)

        expect(adapterSource).toContain('createActiveWidgetPropContext')
        expect(adapterSource).toContain('LEGACY')
    })

    it('does not re-export quarantined event-system APIs from the active page-editor barrel', () => {
        const pageEditorBarrelSource = readSource('src/editors/page-editor/index.js')
        const eventSystemSource = readSource('src/editors/page-editor/PageEditorEventSystem.js')
        const treeRendererSource = readSource('src/editors/page-editor/TreeBasedLayoutRenderer.jsx')

        expect(pageEditorBarrelSource).not.toMatch(/PageEditorEventSystem/)
        expect(pageEditorBarrelSource).not.toMatch(/createPageEditorEventSystem/)
        expect(eventSystemSource).toContain('LEGACY/QUARANTINED')
        expect(treeRendererSource).toContain('LEGACY/QUARANTINED')
    })

    it('keeps legacy renderer imports inside legacy boundary files only', () => {
        const allowedLegacyImportFiles = new Set([
            'src/components/ContentEditor.jsx'
        ])
        const filesToCheck = [
            'src/components/PageEditor.jsx',
            'src/editors/page-editor/PageContentEditor.jsx',
            'src/editors/page-editor/ReactLayoutRenderer.jsx',
            'src/editors/page-editor/PageWidgetFactory.jsx',
            ...allowedLegacyImportFiles
        ]

        for (const file of filesToCheck) {
            const source = readSource(file)
            const importsLegacyRenderer = /from ['"][^'"]*(?:\/|\.)LayoutRenderer(?:\.js|\.jsx)?['"]/.test(source)

            if (allowedLegacyImportFiles.has(file)) {
                expect(importsLegacyRenderer, `${file} should remain the legacy renderer boundary`).toBe(true)
            } else {
                expect(importsLegacyRenderer, `${file} should not import legacy renderer internals`).toBe(false)
            }
        }
    })

    it('leaves the legacy ContentEditor importable but isolated from PageEditor', () => {
        const contentEditorSource = readSource('src/components/ContentEditor.jsx')
        const layoutRendererSource = readSource('src/components/LayoutRenderer.js')
        const pageEditorSource = readSource('src/components/PageEditor.jsx')

        expect(contentEditorSource).toContain('LEGACY/QUARANTINED')
        expect(contentEditorSource).toMatch(/export default ContentEditor/)
        expect(layoutRendererSource).toContain('LEGACY/QUARANTINED')
        expect(pageEditorSource).not.toMatch(/from ['"][^'"]*\/ContentEditor(?:\.jsx)?['"]/)
    })
})
