import { useState, useEffect } from 'react'
import { X, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { pageImportApi } from '../api'
import { namespacesApi } from '../api'

const TreeImporterModal = ({ isOpen, onClose, parentPage = null, onSuccess }) => {
    const [url, setUrl] = useState('')
    const [hostname, setHostname] = useState('')
    const [namespace, setNamespace] = useState('default')
    const [maxDepth, setMaxDepth] = useState(5)
    const [maxPages, setMaxPages] = useState(100)
    const [requestDelay, setRequestDelay] = useState(2.0)
    const [isImporting, setIsImporting] = useState(false)
    const [taskId, setTaskId] = useState(null)
    const [progress, setProgress] = useState(null)
    const [error, setError] = useState(null)

    // Import mode is automatically determined by whether parentPage exists
    const importMode = parentPage ? 'subpage' : 'root'

    // Fetch namespaces
    const { data: namespacesData } = useQuery({
        queryKey: ['namespaces'],
        queryFn: () => namespacesApi.list(),
        enabled: isOpen,
    })

    const namespaces = namespacesData?.results || []

    // Poll for import status
    useEffect(() => {
        if (!taskId || !isImporting) return

        const interval = setInterval(async () => {
            try {
                const statusData = await pageImportApi.getImportStatus(taskId)
                setProgress(statusData.progress)

                if (statusData.status === 'completed') {
                    setIsImporting(false)
                    clearInterval(interval)
                    setTimeout(() => {
                        onSuccess?.()
                        handleClose()
                    }, 2000)
                } else if (statusData.status === 'failed') {
                    setIsImporting(false)
                    setError('Import failed. Please check the logs.')
                    clearInterval(interval)
                }
            } catch (err) {
                console.error('Failed to fetch import status:', err)
                setError('Failed to fetch import status')
                setIsImporting(false)
                clearInterval(interval)
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [taskId, isImporting, onSuccess])

    const handleClose = () => {
        if (!isImporting) {
            setUrl('')
            setHostname('')
            setNamespace('default')
            setMaxDepth(5)
            setMaxPages(100)
            setRequestDelay(2.0)
            setError(null)
            setProgress(null)
            setTaskId(null)
            onClose()
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)
        setProgress(null)

        // Validate inputs
        if (!url) {
            setError('URL is required')
            return
        }

        if (importMode === 'root' && !hostname) {
            setError('Hostname is required for root page import')
            return
        }

        try {
            setIsImporting(true)

            const options = {
                namespace,
                maxDepth,
                maxPages,
                requestDelay,
            }

            if (importMode === 'root') {
                options.hostname = hostname
            } else {
                options.parentPageId = parentPage?.id
            }

            const result = await pageImportApi.importTree(url, options)
            setTaskId(result.taskId)
            setProgress(result.progress)
        } catch (err) {
            console.error('Import failed:', err)
            setError(err.response?.data?.error || 'Import failed')
            setIsImporting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center space-x-2">
                        <Download className="w-5 h-5 text-blue-600" />
                        <div className="text-xl font-semibold text-gray-900" role="heading" aria-level="2">
                            {importMode === 'root' ? 'Import Page Tree as Root' : 'Import Page Tree as Subpage'}
                        </div>
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
                <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                    {/* URL Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            URL to Import
                        </label>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            disabled={isImporting}
                            placeholder="https://example.com/section"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                            required
                        />
                        <div className="mt-1 text-xs text-gray-500">
                            The crawler will import this page and all subpages under this URL path
                        </div>
                    </div>

                    {/* Import Mode Info */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex items-start space-x-2">
                            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-800">
                                {importMode === 'root' ? (
                                    <div>
                                        <span className="font-bold">Import as root page</span>
                                        <div className="mt-1 text-blue-700">
                                            The imported pages will be created as a new root page tree. You must specify a hostname.
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <span className="font-bold">Import as subpage</span>
                                        <div className="mt-1 text-blue-700">
                                            The imported pages will be created under:{' '}
                                            <span className="font-semibold">
                                                "{parentPage.title || parentPage.slug}"
                                            </span>
                                        </div>
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
                                disabled={isImporting}
                                placeholder="example.com"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
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
                            disabled={isImporting}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                        >
                            {namespaces.map((ns) => (
                                <option key={ns.id} value={ns.slug}>
                                    {ns.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Advanced Options */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Max Depth
                            </label>
                            <input
                                type="number"
                                value={maxDepth}
                                onChange={(e) => setMaxDepth(parseInt(e.target.value))}
                                disabled={isImporting}
                                min="1"
                                max="10"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Max Pages
                            </label>
                            <input
                                type="number"
                                value={maxPages}
                                onChange={(e) => setMaxPages(parseInt(e.target.value))}
                                disabled={isImporting}
                                min="1"
                                max="500"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Request Delay (s)
                            </label>
                            <input
                                type="number"
                                value={requestDelay}
                                onChange={(e) => setRequestDelay(parseFloat(e.target.value))}
                                disabled={isImporting}
                                min="0.5"
                                max="10"
                                step="0.5"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                            />
                        </div>
                    </div>
                    {requestDelay < 1.0 && (
                        <div className="flex items-start space-x-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                            <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-yellow-800">
                                Low delay may result in 503 errors. Recommended: 2+ seconds.
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-md">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-red-800">{error}</div>
                        </div>
                    )}

                    {/* Progress */}
                    {progress && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-blue-900">
                                    {progress.status === 'completed' ? 'Import Complete' : 'Importing...'}
                                </span>
                                {progress.status === 'completed' ? (
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                ) : (
                                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                                )}
                            </div>

                            {/* Summary Stats */}
                            <div className="grid grid-cols-3 gap-2 text-sm text-blue-800">
                                <div className="flex flex-col items-center p-2 bg-white rounded">
                                    <span className="text-xs text-gray-600">Discovered</span>
                                    <span className="font-semibold text-lg">{progress.pagesDiscovered}</span>
                                </div>
                                <div className="flex flex-col items-center p-2 bg-white rounded">
                                    <span className="text-xs text-gray-600">Created</span>
                                    <span className="font-semibold text-lg text-green-600">{progress.pagesCreated}</span>
                                </div>
                                <div className="flex flex-col items-center p-2 bg-white rounded">
                                    <span className="text-xs text-gray-600">Skipped</span>
                                    <span className="font-semibold text-lg text-orange-600">{progress.pagesSkipped}</span>
                                </div>
                            </div>

                            {/* Current URL */}
                            {progress.currentUrl && (
                                <div className="p-2 bg-white rounded border border-blue-200">
                                    <div className="text-xs font-medium text-blue-900 mb-1">Currently Processing:</div>
                                    <div className="text-xs text-blue-700 truncate">{progress.currentUrl}</div>
                                </div>
                            )}

                            {/* URL Lists */}
                            <div className="space-y-2">
                                {/* Completed URLs */}
                                {progress.urlsCompleted && progress.urlsCompleted.length > 0 && (
                                    <div className="bg-white rounded p-2 border border-green-200">
                                        <div className="text-xs font-medium text-green-800 mb-1">
                                            ✓ Completed ({progress.urlsCompleted.length}):
                                        </div>
                                        <div className="max-h-20 overflow-y-auto space-y-0.5">
                                            {progress.urlsCompleted.slice(-10).map((url, idx) => (
                                                <div key={idx} className="text-xs text-green-700 truncate">
                                                    {url}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* In Queue URLs */}
                                {progress.urlsInQueue && progress.urlsInQueue.length > 0 && (
                                    <div className="bg-white rounded p-2 border border-blue-200">
                                        <div className="text-xs font-medium text-blue-800 mb-1">
                                            ⏳ In Queue ({progress.urlsInQueue.length}):
                                        </div>
                                        <div className="max-h-20 overflow-y-auto space-y-0.5">
                                            {progress.urlsInQueue.slice(0, 5).map((url, idx) => (
                                                <div key={idx} className="text-xs text-blue-700 truncate">
                                                    {url}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Failed URLs */}
                                {progress.urlsFailed && progress.urlsFailed.length > 0 && (
                                    <div className="bg-white rounded p-2 border border-red-200">
                                        <div className="text-xs font-medium text-red-800 mb-1">
                                            ✗ Failed ({progress.urlsFailed.length}):
                                        </div>
                                        <div className="max-h-24 overflow-y-auto space-y-1">
                                            {progress.urlsFailed.map((item, idx) => (
                                                <div key={idx} className="text-xs">
                                                    <div className="text-red-700 truncate font-medium">{item.url}</div>
                                                    <div className="text-red-600 text-xs ml-2">{item.error}</div>
                                                </div>
                                            ))}
                                        </div>
                                        {progress.urlsFailed.filter(f => f.error?.includes('503')).length > 3 && (
                                            <div className="text-xs text-red-700 mt-2 font-medium">
                                                💡 Tip: Increase request delay to avoid 503 errors
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isImporting}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isImporting ? 'Importing...' : 'Cancel'}
                        </button>
                        <button
                            type="submit"
                            disabled={isImporting}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                            {isImporting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Importing...</span>
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    <span>Start Import</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default TreeImporterModal

