/**
 * Page Data Schemas API Module
 */

import { api } from './client.js'
import { endpoints } from './endpoints.js'
import { wrapApiCall, buildQueryParams } from './utils.js'

export const pageDataSchemasApi = {
    list: wrapApiCall(async (filters = {}) => {
        const queryString = buildQueryParams(filters)
        return api.get(`${endpoints.pageDataSchemas.list}${queryString}`)
    }, 'schemas.list'),

    get: wrapApiCall(async (id) => {
        return api.get(endpoints.pageDataSchemas.detail(id))
    }, 'schemas.get'),

    create: wrapApiCall(async (data) => {
        return api.post(endpoints.pageDataSchemas.list, data)
    }, 'schemas.create'),

    update: wrapApiCall(async (id, data) => {
        return api.patch(endpoints.pageDataSchemas.detail(id), data)
    }, 'schemas.update'),

    delete: wrapApiCall(async (id) => {
        return api.delete(endpoints.pageDataSchemas.detail(id))
    }, 'schemas.delete'),

    getEffective: wrapApiCall(async (layoutName = '') => {
        return api.get(endpoints.pageDataSchemas.effective(layoutName))
    }, 'schemas.effective'),

    validate: wrapApiCall(async (data) => {
        // Validate page data against database schemas (system and layout)
        // Expected data: { page_data: {}, layout_name: string }
        const result = await api.post(endpoints.pageDataSchemas.validate, data)
        return result;
    }, 'schemas.validate'),
}

export default pageDataSchemasApi


