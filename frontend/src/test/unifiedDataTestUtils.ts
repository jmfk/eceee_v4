import type { AppState, LayoutData, PageData, VersionData, WidgetData } from '../contexts/unified-data/types/state'

export const TEST_TIMESTAMP = '2026-01-01T00:00:00.000Z'

export const createWidget = (overrides: Partial<WidgetData> = {}): WidgetData => ({
    id: 'widget-1',
    type: 'content.TextWidget',
    config: {
        content: 'Initial content'
    },
    ...overrides
})

export const createPage = (overrides: Partial<PageData> = {}): PageData => ({
    id: 'page-1',
    title: 'Test Page',
    slug: 'test-page',
    url: '/test-page/',
    status: 'draft',
    currentVersionId: 'version-1',
    availableVersions: ['version-1'],
    metadata: {},
    createdAt: TEST_TIMESTAMP,
    updatedAt: TEST_TIMESTAMP,
    createdBy: 'tester',
    ...overrides
})

export const createLayout = (overrides: Partial<LayoutData> = {}): LayoutData => ({
    id: 'layout-1',
    name: 'Test Layout',
    slots: [
        { id: 'main', name: 'main' }
    ],
    createdAt: TEST_TIMESTAMP,
    updatedAt: TEST_TIMESTAMP,
    ...overrides
})

export const createVersion = (
    overrides: Partial<VersionData> & { versionNumber?: number } = {}
): VersionData & { versionNumber: number } => ({
    id: 'version-1',
    pageId: 'page-1',
    number: 1,
    versionNumber: 1,
    status: 'draft',
    widgets: {
        main: [createWidget()]
    },
    layoutId: 'layout-1',
    content: {},
    metadata: {},
    createdAt: TEST_TIMESTAMP,
    updatedAt: TEST_TIMESTAMP,
    createdBy: 'tester',
    ...overrides
})

export const createAppState = (overrides: Partial<AppState> = {}): AppState => {
    const page = createPage()
    const version = createVersion()
    const layout = createLayout()
    const overrideMetadata = overrides.metadata || {}
    const { widgetStates: overrideWidgetStates, ...metadataOverrides } = overrideMetadata
    const metadata = {
        lastUpdated: TEST_TIMESTAMP,
        isLoading: false,
        isDirty: false,
        isObjectLoading: false,
        isObjectDirty: false,
        isThemeDirty: false,
        currentPageId: page.id,
        currentVersionId: version.id,
        currentObjectId: undefined,
        currentObjectVersionId: undefined,
        currentThemeId: undefined,
        lastViewedVersions: {},
        errors: [],
        warnings: [],
        ...metadataOverrides,
        widgetStates: {
            errors: {},
            activeEditors: [],
            ...overrideWidgetStates
        }
    }

    return {
        pages: {
            [page.id]: page
        },
        versions: {
            [version.id]: version
        },
        objects: {},
        layouts: {
            [layout.id]: layout
        },
        themes: {},
        ...overrides,
        metadata
    }
}
