import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RemoteObjectImport from '../RemoteObjectImport'

const mocks = vi.hoisted(() => ({
    remoteConnections: vi.fn(),
    catalog: vi.fn(),
    preflight: vi.fn(),
    createImport: vi.fn(),
    listImports: vi.fn(),
    getImport: vi.fn(),
}))

vi.mock('../../api/designerThemes', () => ({
    designerThemesApi: { remoteConnections: mocks.remoteConnections },
}))

vi.mock('../../api/objectTransfers', () => ({
    objectTransfersApi: {
        catalog: mocks.catalog,
        preflight: mocks.preflight,
        createImport: mocks.createImport,
        listImports: mocks.listImports,
        getImport: mocks.getImport,
    },
}))

describe('RemoteObjectImport', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.remoteConnections.mockResolvedValue({
            results: [{ id: 7, name: 'Remote', credentialScheme: 'api_key', isDefault: true }],
        })
        mocks.listImports.mockResolvedValue({ results: [] })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('restores an active import job after reload', async () => {
        mocks.listImports.mockResolvedValue({
            results: [{ id: 'job-1', status: 'running', progress: { phase: 'downloading' } }],
        })

        render(<RemoteObjectImport onClose={vi.fn()} onCompleted={vi.fn()} />)

        expect(await screen.findByText('Importing · downloading')).toBeInTheDocument()
        expect(mocks.listImports).toHaveBeenCalledOnce()
    })

    it('continues polling after a transient status error', async () => {
        vi.useFakeTimers()
        const onCompleted = vi.fn()
        mocks.listImports.mockResolvedValue({
            results: [{ id: 'job-1', status: 'running', progress: { phase: 'downloading' } }],
        })
        mocks.getImport
            .mockRejectedValueOnce(new Error('Temporary network error'))
            .mockResolvedValueOnce({ id: 'job-1', status: 'completed', progress: { phase: 'completed' } })

        render(<RemoteObjectImport onClose={vi.fn()} onCompleted={onCompleted} />)
        await act(async () => {})

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1500)
        })
        expect(mocks.getImport).toHaveBeenCalledTimes(1)
        expect(screen.getByText(/Temporary network error/)).toBeInTheDocument()

        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000)
        })
        expect(mocks.getImport).toHaveBeenCalledTimes(2)
        expect(screen.getByText('Import completed')).toBeInTheDocument()
        expect(onCompleted).toHaveBeenCalledOnce()

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10000)
        })
        expect(mocks.getImport).toHaveBeenCalledTimes(2)
    })

    it('requires explicit resolutions for every conflict', async () => {
        const user = userEvent.setup()
        mocks.catalog
            .mockResolvedValueOnce({ objectTypes: [{ name: 'article', label: 'Article', pluralLabel: 'Articles' }] })
            .mockResolvedValueOnce({
                results: [{
                    objectType: { name: 'article', pluralLabel: 'Articles' },
                    candidates: [{ id: 11, title: 'Article', status: 'published', descendantCount: 0 }],
                }],
            })
        mocks.preflight.mockResolvedValue({
            objectCount: 1,
            versionCount: 1,
            mediaCount: 0,
            limits: { withinLimits: true },
            typeConflicts: [{ name: 'article', compatible: false, usedByOtherTenants: false }],
            namespaceConflicts: [{ name: 'Remote content', slug: 'remote' }],
            destinationNamespaces: [{ name: 'Local content', slug: 'local' }],
        })
        mocks.createImport.mockResolvedValue({ id: 'job-2', status: 'pending', progress: { phase: 'queued' } })
        render(<RemoteObjectImport onClose={vi.fn()} onCompleted={vi.fn()} />)

        await user.click(await screen.findByRole('button', { name: 'Load types' }))
        await user.click(await screen.findByRole('checkbox', { name: /Articles/ }))
        await user.click(screen.getByRole('button', { name: 'Load candidates' }))
        const candidateSection = (await screen.findByRole('heading', { name: 'Choose root objects' })).closest('section')
        await user.click(within(candidateSection).getByRole('checkbox', { name: /Article/ }))
        await user.click(screen.getByRole('button', { name: 'Review import' }))

        const startButton = await screen.findByRole('button', { name: 'Start import' })
        expect(startButton).toBeDisabled()
        await user.selectOptions(screen.getByLabelText('Resolve article'), 'update')
        expect(startButton).toBeDisabled()
        await user.selectOptions(screen.getByLabelText('Map namespace “Remote content”'), 'local')
        expect(startButton).toBeEnabled()
        await user.click(startButton)

        await waitFor(() => expect(mocks.createImport).toHaveBeenCalledWith(
            7,
            [11],
            { article: 'update' },
            { remote: 'local' },
        ))
    })
})
