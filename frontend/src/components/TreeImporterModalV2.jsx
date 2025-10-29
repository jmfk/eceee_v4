import { useState, useEffect, useRef } from 'react'
import { X, Download, AlertCircle, CheckCircle, Loader2, SkipForward } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { pageImportApi } from '../api'
import { namespacesApi } from '../api'

/**
 * Get a shortened display version of a URL
 * Shows the last path segment primarily, with hostname prefix if needed
 */
const getShortUrl = (url) => {
    try {
        const urlObj = new URL(url)
        const pathParts = urlObj.pathname.split('/').filter(Boolean)

        if (pathParts.length === 0) {
            // Root path
            return urlObj.hostname
        }

        // Get last path segment
        const lastPart = pathParts[pathParts.length - 1]

        // If URL is too long, show hostname + last part
        if (url.length > 60) {
            return `${urlObj.hostname}/.../${lastPart}`
        }

        return lastPart
    } catch (e) {
        return url
    }
}

/**
 * Find the parent URL for a given URL based on path hierarchy
 * E.g., /summerstudy/about/evaluations → parent is /summerstudy/about
 */
const findParentUrl = (url, allUrls) => {
    try {
        const urlObj = new URL(url)
        const pathParts = urlObj.pathname.split('/').filter(Boolean)

        // If it's a root path or single segment, no parent
        if (pathParts.length <= 1) {
            return null
        }

        // Build parent path by removing last segment
        const parentPathParts = pathParts.slice(0, -1)
        const parentPath = '/' + parentPathParts.join('/')

        // Construct potential parent URL
        const parentUrl = `${urlObj.protocol}//${urlObj.host}${parentPath}`

        // Check if parent URL exists in our list
        if (allUrls.includes(parentUrl)) {
            return parentUrl
        }

        // Also try without trailing slash normalization
        const parentUrlNoSlash = parentUrl.endsWith('/') ? parentUrl.slice(0, -1) : parentUrl
        const parentUrlWithSlash = parentUrl.endsWith('/') ? parentUrl : parentUrl + '/'

        if (allUrls.includes(parentUrlNoSlash)) {
            return parentUrlNoSlash
        }
        if (allUrls.includes(parentUrlWithSlash)) {
            return parentUrlWithSlash
        }

        return null
    } catch (e) {
        return null
    }
}

const TreeImporterModalV2 = ({ isOpen, onClose, parentPage = null, onSuccess }) => {
    const [startUrl, setStartUrl] = useState('')
    const [hostname, setHostname] = useState('')
    const [namespace, setNamespace] = useState('default')
    const [requestDelay, setRequestDelay] = useState(2.0)
    const [isImporting, setIsImporting] = useState(false)
    const [error, setError] = useState(null)

    // Queue management
    const [queue, setQueue] = useState([]) // URLs to process
    const [completed, setCompleted] = useState([]) // {url, title, slug, skipped}
    const [failed, setFailed] = useState([]) // {url, error}
    const [currentUrl, setCurrentUrl] = useState(null)
    const [visitedUrls, setVisitedUrls] = useState(new Set())
    const [isFirstPage, setIsFirstPage] = useState(true) // Track if processing first page

    // URL to parent page ID mapping (critical for hierarchy)
    const [urlToParentMap, setUrlToParentMap] = useState({})

    // Use ref to track if import should stop
    const shouldStopRef = useRef(false)

    // Import mode is automatically determined by whether parentPage exists
    const importMode = parentPage ? 'subpage' : 'root'

    // Fetch namespaces
    const { data: namespacesData } = useQuery({
        queryKey: ['namespaces'],
        queryFn: () => namespacesApi.list(),
        enabled: isOpen,
    })

    const namespaces = namespacesData?.results || []

    const handleClose = () => {
        if (!isImporting) {
            setStartUrl('')
            setHostname('')
            setNamespace('default')
            setRequestDelay(2.0)
            setError(null)
            setQueue([])
            setCompleted([])
            setFailed([])
            setCurrentUrl(null)
            setVisitedUrls(new Set())
            setUrlToParentMap({})
            setIsFirstPage(true)
            shouldStopRef.current = false
            onClose()
        }
    }

    const handleStart = async (e) => {
        e.preventDefault()
        setError(null)

        // Validate inputs
        if (!startUrl) {
            setError('URL is required')
            return
        }

        if (importMode === 'root' && !hostname) {
            setError('Hostname is required for root page import')
            return
        }

        // Initialize queue with start URL
        setQueue([startUrl])
        setVisitedUrls(new Set([startUrl]))
        setCompleted([])
        setFailed([])

        // Initialize URL to parent mapping
        // The start URL imports under the specified parent (or as root)
        // For subpage mode, the start URL's children will be imported under it
        const initialMapping = {}
        if (importMode === 'subpage' && parentPage?.id) {
            initialMapping[startUrl] = parentPage.id
        }
        setUrlToParentMap(initialMapping)
        setIsFirstPage(true)

        shouldStopRef.current = false
        setIsImporting(true)
    }

    const handleStop = () => {
        shouldStopRef.current = true
        setIsImporting(false)
    }

    const handleSkipUrl = (url) => {
        setQueue(prev => prev.filter(u => u !== url))
        setVisitedUrls(prev => new Set([...prev, url]))
    }

    // Process queue
    useEffect(() => {
        if (!isImporting || queue.length === 0 || currentUrl) {
            // If queue is empty and not processing, we're done
            if (isImporting && queue.length === 0 && !currentUrl) {
                setIsImporting(false)
                // Trigger success callback to refresh tree, but keep modal open for review
                if (completed.length > 0) {
                    onSuccess?.()
                }
            }
            return
        }

        // Check if should stop
        if (shouldStopRef.current) {
            setIsImporting(false)
            return
        }

        // Process next URL in queue
        const processNext = async () => {
            const url = queue[0]
            setCurrentUrl(url)
            setQueue(prev => prev.slice(1)) // Remove from queue

            try {
                const options = {
                    namespace,
                    requestDelay,
                    baseUrl: startUrl, // Filter discovered links to same base
                }

                // Determine parent for this URL
                // Use mapping if available, otherwise use initial parent
                const urlParentId = urlToParentMap[url]

                if (importMode === 'root' && !urlParentId) {
                    options.hostname = hostname
                } else {
                    options.parentPageId = urlParentId || parentPage?.id
                }

                const result = await pageImportApi.importSinglePage(url, options)

                if (result.success) {
                    // Check if this is the first page and has same slug as parent
                    const shouldMergeWithParent =
                        isFirstPage &&
                        importMode === 'subpage' &&
                        result.page?.slug === parentPage?.slug

                    let pageId = result.page?.useAsParentId

                    if (shouldMergeWithParent) {
                        // Don't create duplicate - use parent page instead
                        pageId = parentPage.id

                        // Add to completed with special note
                        setCompleted(prev => [...prev, {
                            url,
                            title: result.page?.title || 'Untitled',
                            slug: result.page?.slug || '',
                            skipped: true,
                            reason: `Merged with parent page "${parentPage.title || parentPage.slug}"`
                        }])
                    } else {
                        // Normal import
                        // Add to completed
                        setCompleted(prev => [...prev, {
                            url,
                            title: result.page?.title || 'Untitled',
                            slug: result.page?.slug || '',
                            skipped: result.page?.skipped || false,
                            reason: result.page?.reason || null
                        }])
                    }

                    // Mark first page as processed
                    if (isFirstPage) {
                        setIsFirstPage(false)
                    }

                    // Add discovered URLs to queue (if not visited)
                    if (result.discoveredUrls && result.discoveredUrls.length > 0) {
                        const newUrls = result.discoveredUrls.filter(u => !visitedUrls.has(u))
                        if (newUrls.length > 0) {
                            setQueue(prev => [...prev, ...newUrls])
                            setVisitedUrls(prev => new Set([...prev, ...newUrls]))

                            // Map each discovered URL to its correct parent based on URL structure
                            setUrlToParentMap(prev => {
                                const newMapping = { ...prev }

                                // Update current URL mapping
                                if (pageId) {
                                    newMapping[url] = pageId
                                }

                                newUrls.forEach(discoveredUrl => {
                                    // Find parent URL based on path hierarchy
                                    const allProcessedUrls = [...Object.keys(newMapping), url]
                                    const parentUrl = findParentUrl(discoveredUrl, allProcessedUrls)

                                    if (parentUrl && newMapping[parentUrl]) {
                                        // Use the page ID from the parent URL
                                        newMapping[discoveredUrl] = newMapping[parentUrl]
                                    } else if (pageId) {
                                        // Fallback: use current page as parent (or merged parent for first page)
                                        newMapping[discoveredUrl] = pageId
                                    }
                                })

                                return newMapping
                            })
                        }
                    }
                } else if (result.error) {
                    setFailed(prev => [...prev, { url, error: result.error }])
                }

            } catch (err) {
                console.error('Import failed:', err)
                setFailed(prev => [...prev, {
                    url,
                    error: err.response?.data?.error || err.message || 'Import failed'
                }])
            } finally {
                setCurrentUrl(null)
            }
        }

        processNext()
    }, [isImporting, queue, currentUrl, namespace, requestDelay, startUrl, importMode, hostname, parentPage, onSuccess, visitedUrls])

    if (!isOpen) return null

    const stats = {
        total: visitedUrls.size,
        completed: completed.length,
        failed: failed.length,
        inQueue: queue.length,
        processing: currentUrl ? 1 : 0
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center space-x-2">
                        <Download className="w-5 h-5 text-blue-600" />
                        <h2 className="text-xl font-semibold text-gray-900">
                            {importMode === 'root' ? 'Import Page Tree as Root' : 'Import Page Tree as Subpage'}
                        </h2>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isImporting}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleStart} className="px-6 py-4 space-y-4">
                    {/* Configuration (only show if not importing) */}
                    {!isImporting && completed.length === 0 && (
                        <>
                            {/* URL Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Starting URL
                                </label>
                                <input
                                    type="url"
                                    value={startUrl}
                                    onChange={(e) => setStartUrl(e.target.value)}
                                    placeholder="https://example.com/section"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                            </div>

                            {/* Import Mode Info */}
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                                <div className="flex items-start space-x-2">
                                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-blue-800">
                                        {importMode === 'root' ? (
                                            <div>
                                                <strong>Import as root page</strong>
                                                <p className="mt-1 text-blue-700">
                                                    Pages will be created as a new root page tree. You must specify a hostname.
                                                </p>
                                            </div>
                                        ) : (
                                            <div>
                                                <strong>Import as subpage</strong>
                                                <p className="mt-1 text-blue-700">
                                                    Pages will be created under: <span className="font-semibold">"{parentPage.title || parentPage.slug}"</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Hostname (for root page import) */}
                            {importMode === 'root' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Hostname
                                    </label>
                                    <input
                                        type="text"
                                        value={hostname}
                                        onChange={(e) => setHostname(e.target.value)}
                                        placeholder="example.com"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    />
                                </div>
                            )}

                            {/* Namespace */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Namespace (for tags)
                                </label>
                                <select
                                    value={namespace}
                                    onChange={(e) => setNamespace(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    {namespaces.map((ns) => (
                                        <option key={ns.id} value={ns.slug}>
                                            {ns.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Request Delay */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Request Delay (seconds)
                                </label>
                                <input
                                    type="number"
                                    value={requestDelay}
                                    onChange={(e) => setRequestDelay(parseFloat(e.target.value))}
                                    min="0.5"
                                    max="10"
                                    step="0.5"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                                {requestDelay < 1.0 && (
                                    <p className="mt-1 text-xs text-yellow-700">
                                        ⚠️ Low delay may result in 503 errors. Recommended: 2+ seconds.
                                    </p>
                                )}
                            </div>
                        </>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-md">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    {/* Progress Stats */}
                    {(isImporting || completed.length > 0) && (
                        <div className="grid grid-cols-5 gap-2 text-sm">
                            <div className="flex flex-col items-center p-3 bg-gray-50 rounded">
                                <span className="text-xs text-gray-600">Total</span>
                                <span className="font-semibold text-lg">{stats.total}</span>
                            </div>
                            <div className="flex flex-col items-center p-3 bg-green-50 rounded">
                                <span className="text-xs text-gray-600">Completed</span>
                                <span className="font-semibold text-lg text-green-600">{stats.completed}</span>
                            </div>
                            <div className="flex flex-col items-center p-3 bg-red-50 rounded">
                                <span className="text-xs text-gray-600">Failed</span>
                                <span className="font-semibold text-lg text-red-600">{stats.failed}</span>
                            </div>
                            <div className="flex flex-col items-center p-3 bg-blue-50 rounded">
                                <span className="text-xs text-gray-600">In Queue</span>
                                <span className="font-semibold text-lg text-blue-600">{stats.inQueue}</span>
                            </div>
                            <div className="flex flex-col items-center p-3 bg-yellow-50 rounded">
                                <span className="text-xs text-gray-600">Processing</span>
                                <span className="font-semibold text-lg text-yellow-600">{stats.processing}</span>
                            </div>
                        </div>
                    )}

                    {/* Current URL */}
                    {currentUrl && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                            <div className="flex items-center space-x-2">
                                <Loader2 className="w-4 h-4 text-yellow-600 animate-spin flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-yellow-900">Processing:</p>
                                    <p className="text-sm font-semibold text-yellow-800" title={currentUrl}>
                                        {getShortUrl(currentUrl)}
                                    </p>
                                    <p className="text-xs text-yellow-600 truncate">{currentUrl}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* URL Lists in 2 columns */}
                    {(isImporting || completed.length > 0 || failed.length > 0) && (
                        <div className="grid grid-cols-2 gap-4">
                            {/* Left column: Queue + Failed */}
                            <div className="space-y-3">
                                {/* Queue */}
                                {queue.length > 0 && (
                                    <div className="bg-blue-50 rounded-md p-3 border border-blue-200">
                                        <p className="text-sm font-medium text-blue-900 mb-2">
                                            📋 Queue ({queue.length})
                                        </p>
                                        <div className="max-h-48 overflow-y-auto space-y-1">
                                            {queue.slice(0, 20).map((url, idx) => (
                                                <div key={idx} className="flex items-center justify-between gap-2 text-xs bg-white p-2 rounded">
                                                    <span
                                                        className="truncate text-blue-700 flex-1"
                                                        title={url}
                                                    >
                                                        {getShortUrl(url)}
                                                    </span>
                                                    <button
                                                        onClick={() => handleSkipUrl(url)}
                                                        className="flex-shrink-0 p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                                        title="Skip this URL"
                                                    >
                                                        <SkipForward className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            {queue.length > 20 && (
                                                <p className="text-xs text-blue-600 text-center py-1">
                                                    ... and {queue.length - 20} more
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Failed */}
                                {failed.length > 0 && (
                                    <div className="bg-red-50 rounded-md p-3 border border-red-200">
                                        <p className="text-sm font-medium text-red-900 mb-2">
                                            ✗ Failed ({failed.length})
                                        </p>
                                        <div className="max-h-48 overflow-y-auto space-y-2">
                                            {failed.map((item, idx) => (
                                                <div key={idx} className="bg-white p-2 rounded text-xs">
                                                    <p className="text-red-700 font-medium" title={item.url}>
                                                        {getShortUrl(item.url)}
                                                    </p>
                                                    <p className="text-red-600 mt-1 text-xs">{item.error}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right column: Completed */}
                            {completed.length > 0 && (
                                <div className="bg-green-50 rounded-md p-3 border border-green-200">
                                    <p className="text-sm font-medium text-green-900 mb-2">
                                        ✓ Completed ({completed.length})
                                    </p>
                                    <div className="max-h-[400px] overflow-y-auto space-y-1">
                                        {completed.map((item, idx) => (
                                            <div key={idx} className="bg-white p-2 rounded text-xs">
                                                <p className="font-medium text-green-900">{item.title}</p>
                                                <p className="text-green-700">/{item.slug}</p>
                                                {item.skipped && (
                                                    <p className="text-orange-600 text-xs mt-1">
                                                        ⚠️ {item.reason}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                        {!isImporting && completed.length === 0 ? (
                            <>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center space-x-2"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>Start Import</span>
                                </button>
                            </>
                        ) : (
                            <>
                                {isImporting && (
                                    <button
                                        type="button"
                                        onClick={handleStop}
                                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                                    >
                                        Stop Import
                                    </button>
                                )}
                                {!isImporting && (
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 flex items-center space-x-2"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        <span>Done</span>
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </form>
            </div>
        </div>
    )
}

export default TreeImporterModalV2

