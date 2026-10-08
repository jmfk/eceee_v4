import { api } from './client.js'
import { processResponse } from './utils.js'

const base = '/api/v1/webpages/designer'

const unwrap = async (promise) => processResponse(await promise)

export const designerThemesApi = {
    list: async () => unwrap(await api.get(`${base}/themes/`)),
    compare: async (leftThemeId, rightThemeId) => unwrap(await api.post(`${base}/themes/compare/`, { leftThemeId, rightThemeId })),
    versions: async (themeId) => unwrap(await api.get(`${base}/themes/${themeId}/versions/`)),
    createVersion: async (themeId, name) => unwrap(await api.post(`${base}/themes/${themeId}/versions/`, { name })),
    nameVersion: async (themeId, versionId, name) => unwrap(await api.patch(`${base}/themes/${themeId}/versions/${versionId}/`, { name })),
    restoreVersion: async (themeId, versionId) => unwrap(await api.post(`${base}/themes/${themeId}/versions/${versionId}/restore/`)),
    remoteConnections: async () => unwrap(await api.get(`${base}/remote-connections/`)),
    createRemoteConnection: async (connection) => unwrap(await api.post(`${base}/remote-connections/`, connection)),
    updateRemoteConnection: async (connectionId, connection) => unwrap(await api.patch(`${base}/remote-connections/${connectionId}/`, connection)),
    deleteRemoteConnection: async (connectionId) => unwrap(await api.delete(`${base}/remote-connections/${connectionId}/`)),
    remoteThemes: async (connectionId) => unwrap(await api.post(`${base}/themes/remote/`, { connectionId })),
    pullRemoteTheme: async (connectionId, stableKey) => unwrap(await api.post(`${base}/themes/remote/pull/`, { connectionId, stableKey })),
    pushRemoteTheme: async (connectionId, themeId) => unwrap(await api.post(`${base}/themes/remote/push/`, { connectionId, themeId })),
    workspace: async (themeId) => unwrap(await api.get(`${base}/themes/${themeId}/workspace/`)),
    savePreviewContent: async (themeId, viewId, texts, draftVersion) => unwrap(await api.patch(`${base}/themes/${themeId}/preview-content/`, { viewId, texts, draftVersion })),
    importPreviewSource: async (themeId, sourceKind, sourceId, draftVersion) => unwrap(await api.post(`${base}/themes/${themeId}/preview-content/import/`, { sourceKind, sourceId, draftVersion })),
    deletePreviewContent: async (themeId, viewId, draftVersion) => unwrap(await api.delete(`${base}/themes/${themeId}/preview-content/`, { data: { viewId, draftVersion } })),
    replacePreviewImage: async (themeId, viewId, sourceUrl, sourcePath, sourceMatchIndex, image, draftVersion) => {
        const form = new FormData()
        form.append('view_id', viewId)
        form.append('source_url', sourceUrl)
        form.append('source_path', JSON.stringify(sourcePath))
        form.append('source_match_index', String(sourceMatchIndex))
        form.append('image', image)
        form.append('draft_version', draftVersion)
        return unwrap(await api.post(`${base}/themes/${themeId}/preview-content/image/`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }))
    },
    importPreviewFromSite: async (themeId, sourceSiteId, draftVersion) => unwrap(await api.post(`${base}/themes/${themeId}/preview-content/from-site/`, { sourceSiteId, draftVersion })),
    loadPreviewPage: async (themeId, sourcePageId) => unwrap(await api.post(`${base}/themes/${themeId}/preview-content/from-page/`, { sourcePageId })),
    loadPreviewObject: async (themeId, sourceObjectId) => unwrap(await api.post(`${base}/themes/${themeId}/preview-content/from-object/`, { sourceObjectId })),
    save: async (themeId, patch) => unwrap(await api.patch(`${base}/themes/${themeId}/workspace/`, patch)),
    publish: async (themeId, draftVersion) => unwrap(await api.post(`${base}/themes/${themeId}/publish/`, { draftVersion })),
    undo: async (themeId, draftVersion, liveSyncVersion) => unwrap(await api.post(`${base}/themes/${themeId}/undo/`, { draftVersion, liveSyncVersion })),
    discard: async (themeId, draftVersion) => unwrap(await api.post(`${base}/themes/${themeId}/discard/`, { draftVersion })),
    replaceAsset: async (themeId, assetKey, image, draftVersion, targetBreakpoint = null) => {
        const form = new FormData()
        form.append('asset_key', assetKey)
        form.append('image', image)
        form.append('draft_version', draftVersion)
        if (targetBreakpoint) form.append('target_breakpoint', targetBreakpoint)
        return unwrap(await api.post(`${base}/themes/${themeId}/replace-asset/`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }))
    },
    createPlaceholder: async (themeId, data) => unwrap(await api.post(`${base}/themes/${themeId}/placeholder/`, data)),
    createExport: async (themeId) => unwrap(await api.post(`${base}/themes/${themeId}/export/`)),
    getExport: async (jobId) => unwrap(await api.get(`${base}/theme-exports/${jobId}/`)),
    getExportDownload: async (jobId) => unwrap(await api.get(`${base}/theme-exports/${jobId}/download/`)),
}

export default designerThemesApi
