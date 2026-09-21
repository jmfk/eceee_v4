import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { statisticsApi } from '../../api/statistics'
import StatisticsDashboard from './StatisticsDashboard'

vi.mock('../../api/statistics', () => ({
  statisticsApi: {
    getSummary: vi.fn(),
  },
}))

describe('StatisticsDashboard', () => {
  beforeEach(() => {
    statisticsApi.getSummary.mockReset()
  })

  it('renders statistics returned by the API instead of placeholder data', async () => {
    statisticsApi.getSummary.mockResolvedValue({
      data: {
        totalViews: 42,
        totalUniques: 17,
        avgTime: 15.4,
        conversionRate: 25,
        trafficOverview: [{ date: '2026-01-01', views: 42 }],
        topPages: [{ url: 'https://tenant.example/real-page', views: 42 }],
      },
    })

    render(<StatisticsDashboard tenantId="tenant-a" />)

    await waitFor(() => expect(screen.getAllByText('42')).toHaveLength(3))
    expect(screen.getByText('17')).toBeInTheDocument()
    expect(screen.getByText('15s')).toBeInTheDocument()
    expect(screen.getByText('25.0%')).toBeInTheDocument()
    expect(screen.getByText('2026-01-01')).toBeInTheDocument()
    expect(screen.getByText('https://tenant.example/real-page')).toBeInTheDocument()
    expect(screen.queryByText('3.2%')).not.toBeInTheDocument()
    expect(screen.queryByText('/blog/ai-future')).not.toBeInTheDocument()
  })

  it('shows honest empty states when the API returns no data', async () => {
    statisticsApi.getSummary.mockResolvedValue({
      data: {
        totalViews: 0,
        totalUniques: 0,
        avgTime: 0,
        conversionRate: 0,
        trafficOverview: [],
        topPages: [],
      },
    })

    render(<StatisticsDashboard tenantId="tenant-a" />)

    expect(await screen.findByText('No traffic recorded for this date range.')).toBeInTheDocument()
    expect(screen.getByText('No page views recorded for this date range.')).toBeInTheDocument()
  })
})
