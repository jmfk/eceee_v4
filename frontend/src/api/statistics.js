import apiClient from './client'
import { getCurrentTenantId } from '../utils/tenant'

const API_BASE = '/api/v1/statistics'

const tenantHeaders = (tenantId = getCurrentTenantId()) => ({
  'X-Tenant-ID': tenantId,
})

export const statisticsApi = {
  getSummary: ({ start, end, tenantId } = {}) => apiClient.get(
    `${API_BASE}/page-stats/summary/`,
    {
      params: { start, end },
      headers: tenantHeaders(tenantId),
    },
  ),

  getExperiments: ({ tenantId } = {}) => apiClient.get(
    `${API_BASE}/experiments/`,
    { headers: tenantHeaders(tenantId) },
  ),

  createExperiment: (data, { tenantId } = {}) => apiClient.post(
    `${API_BASE}/experiments/`,
    data,
    { headers: tenantHeaders(tenantId) },
  ),

  updateExperiment: (id, data, { tenantId } = {}) => apiClient.patch(
    `${API_BASE}/experiments/${id}/`,
    data,
    { headers: tenantHeaders(tenantId) },
  ),
}

