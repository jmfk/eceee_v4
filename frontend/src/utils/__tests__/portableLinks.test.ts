import { describe, expect, it } from 'vitest'
import { portableInternalHref } from '../portableLinks'

const localRuntime = { protocol: 'http:', hostname: 'localhost', port: '10100' } as Location

describe('portableInternalHref', () => {
    it('keeps same-site links relative', () => {
        expect(portableInternalHref({ path: '/programme/' }, '#', localRuntime)).toBe('/programme/')
    })

    it('uses the active frontend port for cross-site tenant links', () => {
        expect(portableInternalHref({
            path: '/',
            siteHostname: 'industry.localhost',
        }, '#', localRuntime)).toBe('http://industry.localhost:10100/')
    })

    it('preserves portable query and anchor values', () => {
        expect(portableInternalHref({
            path: '/programme/',
            query: 'view=full',
            anchor: 'details',
        }, '#', localRuntime)).toBe('/programme/?view=full#details')
    })

    it('does not turn invalid host metadata into a URL', () => {
        expect(portableInternalHref({
            path: '/programme/',
            siteHostname: 'https://attacker.test',
        }, '#', localRuntime)).toBe('/programme/')
    })
})
