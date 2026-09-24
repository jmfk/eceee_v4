import { api } from './client.js'
import { processResponse } from './utils.js'

const base = '/api/v1/webpages/designer'

const unwrap = async (promise) => processResponse(await promise)

export const designerThemesApi = {
    list: async () => unwrap(await api.get(`${base}/themes/`)),
    workspace: async (themeId) => unwrap(await api.get(`${base}/themes/${themeId}/workspace/`)),
    preview: async (themeId, patch) => unwrap(await api.post(`${base}/themes/${themeId}/preview/`, patch)),
    save: async (themeId, patch) => unwrap(await api.patch(`${base}/themes/${themeId}/workspace/`, patch)),
    publish: async (themeId, draftVersion) => unwrap(await api.post(`${base}/themes/${themeId}/publish/`, { draftVersion })),
    discard: async (themeId, draftVersion) => unwrap(await api.post(`${base}/themes/${themeId}/discard/`, { draftVersion })),
    replaceAsset: async (themeId, assetKey, image, draftVersion) => {
        const form = new FormData()
        form.append('asset_key', assetKey)
        form.append('image', image)
        form.append('draft_version', draftVersion)
        return unwrap(await api.post(`${base}/themes/${themeId}/replace-asset/`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }))
    },
    createPlaceholder: async (themeId, data) => unwrap(await api.post(`${base}/themes/${themeId}/placeholder/`, data)),
    generatePreviewContent: async (themeId, prompt = '') => unwrap(await api.post(`${base}/themes/${themeId}/preview-content/`, { prompt })),
    createExport: async (themeId) => unwrap(await api.post(`${base}/themes/${themeId}/export/`)),
    getExport: async (jobId) => unwrap(await api.get(`${base}/theme-exports/${jobId}/`)),
    getExportDownload: async (jobId) => unwrap(await api.get(`${base}/theme-exports/${jobId}/download/`)),
}

export default designerThemesApi
