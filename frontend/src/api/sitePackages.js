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

    createImport: wrapApiCall(async ({ file, preservePublicationStatus = true }) => {
        const formData = new FormData()
        formData.append('site_zip', file)
        formData.append('preservePublicationStatus', preservePublicationStatus ? 'true' : 'false')
        return api.post(endpoints.sitePackages.imports, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })
    }, 'sitePackages.createImport'),

    getImport: wrapApiCall(async (jobId) => {
        return api.get(endpoints.sitePackages.importDetail(jobId))
    }, 'sitePackages.getImport')
}

export default sitePackagesApi
