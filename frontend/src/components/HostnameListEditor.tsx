import { useState, type FormEvent } from 'react'

type Props = {
    value: string[]
    onChange: (hostnames: string[]) => void
}

const label = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?'
const hostname = new RegExp(`^${label}(?:\\.${label})*$`)
const scopedWildcard = new RegExp(`^\\*\\.${label}(?:\\.${label})+$`)

export default function HostnameListEditor({ value, onChange }: Props) {
    const [candidate, setCandidate] = useState('')
    const [error, setError] = useState('')

    const add = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const next = candidate.trim().toLowerCase()
        if (!hostname.test(next) && !scopedWildcard.test(next)) {
            setError('Enter a hostname or scoped wildcard such as *.colliberty.com.')
            return
        }
        if (value.some(existing => existing.toLowerCase() === next)) {
            setError('This hostname is already in the list.')
            return
        }
        onChange([...value, next])
        setCandidate('')
        setError('')
    }

    return (
        <div>
            <label htmlFor="new-root-hostname" className="block text-sm font-medium text-gray-700 mb-2">
                Hostnames
            </label>
            <ul aria-label="Root page hostnames" className="space-y-2 mb-3">
                {value.map((host, index) => (
                    <li key={`${host}-${index}`} className="flex items-center justify-between gap-3 rounded-md border border-gray-300 px-3 py-2">
                        <span className="min-w-0 break-all text-gray-900">{host}</span>
                        <button
                            type="button"
                            onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                            aria-label={`Remove ${host}`}
                            className="shrink-0 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            Remove
                        </button>
                    </li>
                ))}
            </ul>
            <form onSubmit={add} className="flex flex-wrap gap-2">
                <input
                    id="new-root-hostname"
                    type="text"
                    value={candidate}
                    onChange={event => { setCandidate(event.target.value); setError('') }}
                    className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="example.com or *.colliberty.com"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'hostname-error hostname-help' : 'hostname-help'}
                />
                <button type="submit" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    Add
                </button>
            </form>
            {error && <p id="hostname-error" role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
            <p id="hostname-help" className="mt-2 text-sm text-gray-500">
                Wildcards match subdomains only. Add the base domain separately if needed.
            </p>
        </div>
    )
}
