import React, { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WebsiteSettings from '../WebsiteSettings'
import AccountPrivacyPanel from '../AccountPrivacyPanel'
import SubmissionsPage from '../../pages/SubmissionsPage'
import client from '../../api/client'
import { supportRequest } from '../../api/support'
const auth = vi.hoisted(() => ({ user: { id: 'editor-a', permissions: ['page.read', 'page.write'] } }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../../api/client', () => ({ default: { get: vi.fn(), patch: vi.fn() } }))
vi.mock('../../api/support', () => ({ supportRequest: vi.fn(), supportError: () => 'Retry request.' }))
vi.mock('../media/MediaSelectModal', () => ({ default: () => null }))
vi.mock('../LinkPicker', () => ({ default: ({ isOpen, onSave }: any) => isOpen ? <button onClick={() => onSave({ link: { pageId: '24' }, title: 'Swedish page' })}>Select Swedish page</button> : null }))
vi.mock('../UserToolsNav', () => ({ default: () => <nav aria-label="Personal tools" /> }))
vi.mock('../support/useSupportContext', () => ({ useSupportTenant: () => 'tenant-a' }))
function Settings() {
    const [value, setValue] = useState({ language: 'en' })
    return <WebsiteSettings value={value} onChange={setValue} isRoot pageId="1" />
}
beforeEach(() => { vi.clearAllMocks(); auth.user = { id: 'editor-a', permissions: ['page.read', 'page.write'] } })
describe('website controls', () => {
    it('selects translated pages and keeps accessible labels on populated fields', () => {
        render(<Settings />)
        expect(screen.getByLabelText('Page language (en, sv…)')).toHaveValue('en')
        fireEvent.change(screen.getByLabelText('Translation language'), { target: { value: 'sv' } })
        fireEvent.click(screen.getByRole('button', { name: 'Choose translated page' }))
        fireEvent.click(screen.getByRole('button', { name: 'Select Swedish page' }))
        fireEvent.click(screen.getByRole('button', { name: 'Add translation' }))
        expect(screen.getByText('sv: page 24')).toBeInTheDocument()
        expect(screen.getByLabelText('Ask for consent before collecting statistics')).toBeChecked()
    })
    it('creates a tracked deletion request without deleting the account', async () => {
        vi.mocked(supportRequest).mockResolvedValue({ id: 'request-1' })
        render(<MemoryRouter><AccountPrivacyPanel tenant="tenant-a" supportAvailable /></MemoryRouter>)
        fireEvent.click(screen.getByRole('button', { name: 'Request account deletion' }))
        expect(await screen.findByRole('link', { name: 'View deletion request' })).toHaveAttribute('href', '/inbox/threads/request-1?tenant=tenant-a')
        expect(supportRequest).toHaveBeenCalledWith('tenant-a', 'threads/', 'post', expect.objectContaining({ recipients: ['support'], title: 'Request account deletion' }))
    })
    it('does not enable deletion requests without a support contact', () => {
        render(<MemoryRouter><AccountPrivacyPanel supportAvailable={false} /></MemoryRouter>)
        expect(screen.getByRole('button', { name: 'Request account deletion' })).toBeDisabled()
    })
    it('passes the workspace and concurrency token when reviewing a submission', async () => {
        const row = { id: 's1', formTitle: 'Event proposal', pageTitle: 'Events', status: 'pending', reviewNote: '', reviewedAt: null, submittedAt: '2026-11-18T12:00:00Z', data: { title: 'A proposed event' } }
        vi.mocked(client.get).mockResolvedValue({ data: { results: [row], count: 1, next: null } })
        vi.mocked(client.patch).mockResolvedValue({ data: { ...row, status: 'pending' } })
        const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(<QueryClientProvider client={cache}><SubmissionsPage /></QueryClientProvider>)
        expect(await screen.findByText('A proposed event')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Save review' }))
        await waitFor(() => expect(client.patch).toHaveBeenCalledWith('/api/v1/webpages/pages/submissions/s1/', expect.objectContaining({ expectedReviewedAt: null }), { headers: { 'X-Tenant-ID': 'tenant-a' } }))
        const pendingTab = screen.getByRole('tab', { name: 'Pending' })
        fireEvent.keyDown(pendingTab, { key: 'ArrowRight' })
        expect(screen.getByRole('tab', { name: 'In review' })).toHaveFocus()
    })
    it('does not show the previous account cached submissions after an account change', async () => {
        vi.mocked(client.get).mockResolvedValue({ data: { results: [{ id: 's1', formTitle: 'Private proposal', pageTitle: 'Events', status: 'pending', reviewNote: '', reviewedAt: null, submittedAt: '2026-11-18T12:00:00Z', data: { email: 'sender@example.org' } }] } })
        const cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300000 } } })
        const tree = () => <QueryClientProvider client={cache}><SubmissionsPage /></QueryClientProvider>
        const view = render(tree())
        expect(await screen.findByText('sender@example.org')).toBeInTheDocument()
        auth.user = { id: 'editor-b', permissions: ['page.write'] }
        view.rerender(tree())
        expect(screen.queryByText('sender@example.org')).not.toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('Reading and editing pages')
        expect(client.get).toHaveBeenCalledTimes(1)
    })

})
