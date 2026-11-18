import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModuleWorkspace } from '../ModuleWorkspace'
const config = { commerce: true, support: true, faq: true, forum: true }
const id = '10000000-0000-0000-0000-000000000001'
let fetcher: ReturnType<typeof vi.fn>
beforeEach(() => {
    fetcher = vi.fn(async (url: string) => {
        if (url.endsWith('/config')) return Response.json(config)
        if (url.endsWith('/products')) return Response.json({ mode: 'test', products: [{ id, name: 'Annual membership', description: 'Member access', active: true }], prices: [{ id: 'price', productId: id, currency: 'eur', amount: 5000, interval: 'year', active: true }] })
        if (url.includes('/threads?')) return Response.json([{ id, title: 'My private conversation', status: 'open' }])
        if (url.includes(`/threads/${id}`)) return Response.json({ thread: { id, title: 'My private conversation', status: 'open' }, messages: [{ id: 'message', authorName: 'Support', body: 'Hello', createdAt: '2026-11-19T12:00:00Z' }] })
        return Response.json([])
    })
    vi.stubGlobal('fetch', fetcher)
})
afterEach(() => vi.unstubAllGlobals())
describe('service module workflows', () => {
    it('shows product terms and a single-product buy action', async () => {
        render(<ModuleWorkspace />)
        expect(await screen.findByRole('heading', { name: 'Annual membership' })).toBeInTheDocument()
        expect(screen.getByText('Member access')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Buy' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Add price' })).not.toBeInTheDocument()
    })
    it('keeps privileged mutations bound to the current tenant', async () => {
        render(<ModuleWorkspace admin tenantId={id} />)
        fireEvent.click(await screen.findByRole('button', { name: 'Save modules' }))
        await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/modules/admin/config', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'X-Tenant-ID': id }) })))
    })
    it('keeps a reply draft after an unsuccessful send', async () => {
        render(<ModuleWorkspace />)
        fireEvent.click(await screen.findByRole('button', { name: 'Support', exact: true }))
        fireEvent.click(await screen.findByRole('button', { name: /My private conversation/ }))
        fireEvent.change(await screen.findByLabelText('Message'), { target: { value: 'Keep my reply' } })
        fetcher.mockImplementation(async (_url: string, options?: RequestInit) => options?.method === 'POST' ? Response.json({ error: 'Please retry sending.' }, { status: 503 }) : Response.json(config))
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Please retry sending.')
        expect(screen.getByLabelText('Message')).toHaveValue('Keep my reply')
    })
    it('lets administrators choose a product price for a subscription change', async () => {
        const base = fetcher.getMockImplementation()!
        fetcher.mockImplementation(async (url: string, options?: RequestInit) => {
            if (url.endsWith('/purchases') && !options?.method?.includes('POST')) return Response.json([{ id: 'purchase', name: 'Annual membership', productId: id, priceId: 'old-price', subscriptionId: 'sub_fixture', status: 'active', amount: 5000, currency: 'eur' }])
            return base(url, options)
        })
        render(<ModuleWorkspace admin tenantId={id} />)
        fireEvent.click(await screen.findByRole('button', { name: 'Purchases', exact: true }))
        fireEvent.click(await screen.findByRole('button', { name: 'Change price…' }))
        fireEvent.click(await screen.findByRole('radio', { name: /50.*year/ }))
        fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }))
        await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/modules/admin/purchases/purchase/subscription', expect.objectContaining({ method: 'POST', body: expect.stringContaining('"priceId":"price"') })))
    })
    it('publishes FAQ entries through an explicit published choice', async () => {
        render(<ModuleWorkspace admin tenantId={id} />)
        fireEvent.click(await screen.findByRole('button', { name: 'FAQ', exact: true }))
        fireEvent.click(await screen.findByRole('button', { name: 'Add FAQ', exact: true }))
        fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'How do I join?' } })
        fireEvent.change(screen.getByLabelText('Answer'), { target: { value: 'Buy a membership.' } })
        fireEvent.click(screen.getByLabelText('Published'))
        fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }))
        await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/modules/admin/faqs', expect.objectContaining({ method: 'POST', body: expect.stringContaining('"published":true') })))
    })
})
