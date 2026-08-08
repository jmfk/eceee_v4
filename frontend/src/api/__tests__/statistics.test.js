import { describe, expect, it, beforeEach } from 'vitest'

import { mockAxiosInstance } from '../../test/setup'
import { statisticsApi } from '../statistics'

describe('statisticsApi', () => {
  beforeEach(() => {
    localStorage.clear()
    mockAxiosInstance.get.mockClear()
    mockAxiosInstance.post.mockClear()
    mockAxiosInstance.patch.mockClear()
  })

  it('uses versioned statistics endpoints and tenant headers', async () => {
    await statisticsApi.getSummary({ start: '2026-01-01', end: '2026-01-07', tenantId: 'tenant-a' })

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/statistics/page-stats/summary/', {
      params: { start: '2026-01-01', end: '2026-01-07' },
      headers: { 'X-Tenant-ID': 'tenant-a' },
    })
  })

  it('creates experiments without sending a body-selected tenant', async () => {
    await statisticsApi.createExperiment(
      { name: 'Headline test', goalMetric: 'conversion' },
      { tenantId: 'tenant-a' },
    )

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/v1/statistics/experiments/',
      { name: 'Headline test', goalMetric: 'conversion' },
      { headers: { 'X-Tenant-ID': 'tenant-a' } },
    )
  })

  it('falls back to configured browser tenant state', async () => {
    localStorage.setItem('eceee_tenant_id', 'stored-tenant')

    await statisticsApi.getExperiments()

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/statistics/experiments/', {
      headers: { 'X-Tenant-ID': 'stored-tenant' },
    })
  })
})
