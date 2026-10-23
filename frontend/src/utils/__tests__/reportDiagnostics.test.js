import { describe, expect, it } from 'vitest'
import { redactDiagnostic, clearReportDiagnostics, reportDiagnostics } from '../reportDiagnostics'

describe('report diagnostics', () => {
    it('redacts URLs, credentials and token-shaped text and bounds messages', () => {
        const value = redactDiagnostic('Error https://cms.example.invalid/?token=private token=private Bearer credential sk-fake-key')
        expect(value).not.toContain('private')
        expect(value).not.toContain('credential')
        expect(value).not.toContain('sk-fake-key')
        expect(redactDiagnostic('x'.repeat(5000)).length).toBeLessThanOrEqual(1000)
    })
    it('clears session diagnostics without reading browser storage', () => {
        clearReportDiagnostics()
        expect(reportDiagnostics()).toEqual({ errors: [] })
    })
})
