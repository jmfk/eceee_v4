import { subscribeToCurrentTenantId } from './tenant'
// Keep only bounded errors, never console arguments, form values, headers or storage.
const errors = []
export const redactDiagnostic = (value) => String(value || '').slice(0, 1000)
    .replace(/https?:\/\/\S+/gi, '[URL]')
    .replace(/(bearer\s+|(?:password|secret|token|api[_-]?key|authorization|cookie)\s*[:=]\s*)\S+/gi, '[redacted]')
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, '[redacted]')
    .replace(/\bsk-[\w-]+\b/g, '[redacted]')
const record = (name, message) => {
    errors.push({ name: redactDiagnostic(name), message: redactDiagnostic(message), time: new Date().toISOString() })
    if (errors.length > 20) errors.shift()
}
export const startReportDiagnostics = () => {
    subscribeToCurrentTenantId(() => { errors.length = 0 })
    window.addEventListener('error', (event) => record(event.error?.name || 'Error', event.message))
    window.addEventListener('unhandledrejection', (event) => record(event.reason?.name || 'Promise rejection', event.reason?.message || 'Unhandled promise rejection'))
}
export const reportDiagnostics = () => ({ errors: [...errors] })

export const clearReportDiagnostics = () => { errors.length = 0 }
