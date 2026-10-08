/**
 * Site package ZIP export/import API.
 */

import { api } from './client.js'
import { endpoints } from './endpoints.js'
import { wrapApiCall } from './utils.js'

export const sitePackagesApi = {
    listExports: wrapApiCall(async () => {
        return api.get(endpoints.sitePackages.exports)
    }, 'sitePackages.listExports'),

    createExport: wrapApiCall(async ({ rootPageId, includeMedia = true, includeThemes = true }) => {
        return api.post(endpoints.sitePackages.exports, {
            rootPageId,
            includeMedia,
            includeThemes
        })
    }, 'sitePackages.createExport'),

    getExport: wrapApiCall(async (jobId) => {
        return api.get(endpoints.sitePackages.exportDetail(jobId))
    }, 'sitePackages.getExport'),

    getExportDownload: wrapApiCall(async (jobId) => {
        return api.get(endpoints.sitePackages.exportDownload(jobId))
    }, 'sitePackages.getExportDownload'),

    listImports: wrapApiCall(async () => {
        return api.get(endpoints.sitePackages.imports)
    }, 'sitePackages.listImports'),

    createImport: wrapApiCall(async ({
        file,
        preservePublicationStatus = true,
        mode = 'prompt',
        existingRootId = null
    }) => {
        const formData = new FormData()
        formData.append('site_zip', file)
        formData.append('preservePublicationStatus', preservePublicationStatus ? 'true' : 'false')
        formData.append('mode', mode)
        if (existingRootId !== null) formData.append('existingRootId', String(existingRootId))
        return api.post(endpoints.sitePackages.imports, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })
    }, 'sitePackages.createImport'),

    getImport: wrapApiCall(async (jobId) => {
        return api.get(endpoints.sitePackages.importDetail(jobId))
    }, 'sitePackages.getImport'),

    listRemoteSites: wrapApiCall(async (connectionId) => {
        return api.post(endpoints.sitePackages.remoteSites, { connectionId })
    }, 'sitePackages.listRemoteSites'),

    createRemoteImport: wrapApiCall(async ({ connectionId, remoteSiteKey, mode, localRootId = null }) => {
        return api.post(endpoints.sitePackages.remoteImports, {
            connectionId,
            remoteSiteKey,
            mode,
            localRootId
        })
    }, 'sitePackages.createRemoteImport')
}

export default sitePackagesApi
