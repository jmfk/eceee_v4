import { useId, useState } from 'react'
import Tooltip from './Tooltip'

export default function ReleaseBadge() {
    const releaseTag = import.meta.env.VITE_RELEASE_TAG?.trim()
    const shortHash = import.meta.env.VITE_GIT_COMMIT_HASH?.trim()
    const commitHash = import.meta.env.VITE_GIT_COMMIT_FULL_HASH?.trim() || shortHash
    const canCopy = Boolean(commitHash && commitHash !== 'unknown')
    const [feedback, setFeedback] = useState('')
    const commitDescriptionId = useId()
    const label = releaseTag || `Git ${shortHash || 'unknown'}`

    const copyHash = async () => {
        try {
            await navigator.clipboard.writeText(commitHash)
            setFeedback('Commit hash copied')
        } catch {
            setFeedback('Could not copy commit hash. Try again.')
        }
    }

    return <Tooltip text={canCopy ? <span className="block w-72 max-w-[calc(100vw-3rem)] whitespace-normal break-all"><span className="block">Git commit {commitHash}</span><span className="mt-1 block font-sans">{feedback || 'Click to copy commit hash'}</span></span> : 'Commit hash unavailable'}>
        <button
            type="button"
            disabled={!canCopy}
            aria-label={canCopy ? `${label} — copy commit hash` : label}
            aria-describedby={canCopy ? commitDescriptionId : undefined}
            onClick={copyHash}
            className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 disabled:cursor-default"
        >{label}</button>
        {canCopy && <span id={commitDescriptionId} className="sr-only">Commit hash: {commitHash}</span>}
        <span role="status" className="sr-only">{feedback}</span>
    </Tooltip>
}
