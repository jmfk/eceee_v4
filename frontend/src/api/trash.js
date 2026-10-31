import apiClient from './client'
import { buildQueryParams, wrapApiCall } from './utils'

export const trashApi = {
    list: (params = {}) => wrapApiCall(() => apiClient.get(`/api/v1/trash/${buildQueryParams(params)}`), 'trash.list')(),
    restore: (items) => wrapApiCall(() => apiClient.post('/api/v1/trash/restore/', { items }), 'trash.restore')(),
}
