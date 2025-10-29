import { X, Scissors, Copy, Files, Globe, GlobeLock, Trash2, CheckSquare } from 'lucide-react'

/**
 * Bulk Actions Toolbar
 * 
 * Inline toolbar that shows bulk operations.
 * Provides bulk operations: cut, copy, duplicate, publish, unpublish, delete.
 */
const BulkActionsToolbar = ({
    selectedCount,
    onCut,
    onCopy,
    onDuplicate,
    onPublish,
    onUnpublish,
    onDelete,
    onClear,
    isProcessing = false
}) => {
    const hasSelection = selectedCount > 0
    const buttonClass = `px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors text-sm
        ${hasSelection
            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
                <button
                    onClick={hasSelection ? onCut : undefined}
                    disabled={!hasSelection || isProcessing}
                    className={buttonClass}
                    title={hasSelection ? "Cut selected pages" : "Select pages to cut"}
                >
                    <Scissors className="w-4 h-4" />
                    <span>Cut</span>
                </button>

                <button
                    onClick={hasSelection ? onCopy : undefined}
                    disabled={!hasSelection || isProcessing}
                    className={buttonClass}
                    title={hasSelection ? "Copy selected pages" : "Select pages to copy"}
                >
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                </button>

                <button
                    onClick={hasSelection ? onDuplicate : undefined}
                    disabled={!hasSelection || isProcessing}
                    className={buttonClass}
                    title={hasSelection ? "Duplicate selected pages" : "Select pages to duplicate"}
                >
                    <Files className="w-4 h-4" />
                    <span>Duplicate</span>
                </button>

                <div className="h-5 w-px bg-gray-300" />

                <button
                    onClick={hasSelection ? onPublish : undefined}
                    disabled={!hasSelection || isProcessing}
                    className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors text-sm
                        ${hasSelection
                            ? 'bg-green-50 hover:bg-green-100 text-green-700'
                            : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                    title={hasSelection ? "Publish selected pages" : "Select pages to publish"}
                >
                    <Globe className="w-4 h-4" />
                    <span>Publish</span>
                </button>

                <button
                    onClick={hasSelection ? onUnpublish : undefined}
                    disabled={!hasSelection || isProcessing}
                    className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors text-sm
                        ${hasSelection
                            ? 'bg-orange-50 hover:bg-orange-100 text-orange-700'
                            : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                    title={hasSelection ? "Unpublish selected pages" : "Select pages to unpublish"}
                >
                    <GlobeLock className="w-4 h-4" />
                    <span>Unpublish</span>
                </button>

                <button
                    onClick={hasSelection ? onDelete : undefined}
                    disabled={!hasSelection || isProcessing}
                    className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors text-sm
                        ${hasSelection
                            ? 'bg-red-50 hover:bg-red-100 text-red-700'
                            : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                    title={hasSelection ? "Delete selected pages" : "Select pages to delete"}
                >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                </button>

                {hasSelection && (
                    <>
                        <div className="h-5 w-px bg-gray-300" />
                        <button
                            onClick={onClear}
                            disabled={isProcessing}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded flex items-center gap-1.5 transition-colors text-sm disabled:opacity-50"
                            title="Clear selection (Escape)"
                        >
                            <X className="w-4 h-4" />
                            <span>Clear</span>
                        </button>
                    </>
                )}
            </div>

            {hasSelection && (
                <>
                    <div className="h-5 w-px bg-gray-300" />
                    <div className="flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-sm text-gray-700">
                            {selectedCount} selected
                        </span>
                    </div>
                </>
            )}
        </div>
    )
}

export default BulkActionsToolbar

