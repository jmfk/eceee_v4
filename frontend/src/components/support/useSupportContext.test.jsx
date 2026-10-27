import { afterEach, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { setCurrentTenantId } from '../../utils/tenant'
import { useSupportTenant } from './useSupportContext'

vi.unmock('react-router-dom')

function TenantProbe() {
    return <span>{useSupportTenant()}</span>
}

afterEach(() => act(() => setCurrentTenantId('')))

it('keeps the inbox workspace when its help article opens separately', () => {
    act(() => setCurrentTenantId('current-workspace'))
    render(
        <MemoryRouter initialEntries={['/help/how-to/record-bug-video?tenant=report-workspace']}>
            <TenantProbe />
        </MemoryRouter>,
    )
    expect(screen.getByText('report-workspace')).toBeInTheDocument()
})

it('uses the scoped workspace on the Settings dashboard', () => {
    act(() => setCurrentTenantId('current-workspace'))
    render(
        <MemoryRouter initialEntries={['/settings?tenant=report-workspace']}>
            <TenantProbe />
        </MemoryRouter>,
    )
    expect(screen.getByText('report-workspace')).toBeInTheDocument()
})
