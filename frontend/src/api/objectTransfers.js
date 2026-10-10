import { api } from './client.js'
import { processResponse } from './utils.js'

const base = '/api/v1/objects/remote'
const unwrap = async promise => processResponse(await promise)

export const objectTransfersApi = {
    catalog: async (connectionId, selections = []) => unwrap(await api.post(`${base}/catalog/`, { connectionId, selections })),
    preflight: async (connectionId, rootIds) => unwrap(await api.post(`${base}/preflight/`, { connectionId, rootIds })),
    createImport: async (connectionId, rootIds, typeResolutions, namespaceResolutions) => unwrap(await api.post(`${base}/imports/`, { connectionId, rootIds, typeResolutions, namespaceResolutions })),
    listImports: async () => unwrap(await api.get(`${base}/imports/`)),
    getImport: async jobId => unwrap(await api.get(`${base}/imports/${jobId}/`)),
    listCheckpoints: async (cursor = null) => unwrap(await api.get(`${base}/checkpoints/`, { params: cursor ? { cursor } : {} })),
    restoreCheckpoint: async checkpointId => unwrap(await api.post(`${base}/checkpoints/${checkpointId}/restore/`, {})),
}

export default objectTransfersApi
