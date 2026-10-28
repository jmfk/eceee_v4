import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import HostnameListEditor from '../HostnameListEditor'

describe('HostnameListEditor', () => {
    it('adds a scoped wildcard without replacing existing hostnames', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        render(<HostnameListEditor value={['summerstudy.eceee.org']} onChange={onChange} />)

        await user.type(screen.getByLabelText('Hostnames'), '*.Colliberty.com')
        await user.click(screen.getByRole('button', { name: 'Add' }))

        expect(onChange).toHaveBeenCalledWith(['summerstudy.eceee.org', '*.colliberty.com'])
    })

    it('removes one hostname and rejects unrestricted or duplicate patterns', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        render(<HostnameListEditor value={['summerstudy.eceee.org']} onChange={onChange} />)

        await user.type(screen.getByLabelText('Hostnames'), '*')
        await user.click(screen.getByRole('button', { name: 'Add' }))
        expect(screen.getByRole('alert')).toHaveTextContent('scoped wildcard')
        expect(onChange).not.toHaveBeenCalled()

        await user.clear(screen.getByLabelText('Hostnames'))
        await user.type(screen.getByLabelText('Hostnames'), 'summerstudy.eceee.org')
        await user.click(screen.getByRole('button', { name: 'Add' }))
        expect(screen.getByRole('alert')).toHaveTextContent('already in the list')

        await user.click(screen.getByRole('button', { name: 'Remove summerstudy.eceee.org' }))
        expect(onChange).toHaveBeenCalledWith([])
    })

    it('shows when another site already uses the hostname', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        const checkAvailability = vi.fn().mockResolvedValue(false)
        render(<HostnameListEditor value={[]} onChange={onChange} checkAvailability={checkAvailability} />)

        await user.type(screen.getByLabelText('Hostnames'), 'summerstudy.localhost')
        await user.click(screen.getByRole('button', { name: 'Add' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('already used by another site')
        expect(checkAvailability).toHaveBeenCalledWith('summerstudy.localhost')
        expect(onChange).not.toHaveBeenCalled()
    })
})
