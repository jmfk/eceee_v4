import { api } from './client.js'
import { processResponse } from './utils.js'

const base = '/api/v1/webpages/layout-editor/themes'
const unwrap = async (promise) => processResponse(await promise)

export const layoutWorkspacesApi = {
    workspace: async (themeId) => unwrap(await api.get(`${base}/${themeId}/workspace/`)),
    save: async (themeId, draftVersion, layouts) => unwrap(await api.patch(`${base}/${themeId}/workspace/`, { draftVersion, layouts })),
    publish: async (themeId, draftVersion) => unwrap(await api.post(`${base}/${themeId}/publish/`, { draftVersion })),
    discard: async (themeId, draftVersion) => unwrap(await api.post(`${base}/${themeId}/discard/`, { draftVersion })),
}

export default layoutWorkspacesApi
