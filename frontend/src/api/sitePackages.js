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

    assessImport: wrapApiCall(async ({ file, themeFiles = [] }) => {
        const formData = new FormData()
        formData.append('site_zip', file)
        themeFiles.forEach((themeFile) => formData.append('theme_zips', themeFile))
        return api.post(endpoints.sitePackages.assess, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
    }, 'sitePackages.assessImport'),

    createImport: wrapApiCall(async ({
        file,
        preservePublicationStatus = true,
        mode = 'prompt',
        existingRootId = null,
        themeFiles = [],
        includeSite = true,
        includeMedia = true,
        includeThemes = true,
        mediaNamespaceName = ''
    }) => {
        const formData = new FormData()
        formData.append('site_zip', file)
        formData.append('preservePublicationStatus', preservePublicationStatus ? 'true' : 'false')
        formData.append('mode', mode)
        formData.append('includeSite', includeSite ? 'true' : 'false')
        formData.append('includeMedia', includeMedia ? 'true' : 'false')
        formData.append('includeThemes', includeThemes ? 'true' : 'false')
        if (mediaNamespaceName) formData.append('mediaNamespaceName', mediaNamespaceName)
        themeFiles.forEach((themeFile) => formData.append('theme_zips', themeFile))
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

    createRemoteImport: wrapApiCall(async ({
        connectionId,
        remoteSiteKey,
        mode,
        localRootId = null,
        includeSite = true,
        includeMedia = true,
        includeThemes = true,
        mediaNamespaceName = ''
    }) => {
        return api.post(endpoints.sitePackages.remoteImports, {
            connectionId,
            remoteSiteKey,
            mode,
            localRootId,
            includeSite,
            includeMedia,
            includeThemes,
            mediaNamespaceName
        })
    }, 'sitePackages.createRemoteImport')
}

export default sitePackagesApi
