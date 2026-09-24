import { Calendar, Check, History, Save, Upload } from 'lucide-react'

const SaveVersionControl = ({
    onSaveClick,
    onUndoChanges,
    onPublishClick,
    onScheduleClick,
    onHistoryClick,
    isSaving = false,
    isNewPage = false,
    isDirty = false,
    canPublish = false,
}) => {
    const hasHistory = !isNewPage && Boolean(onHistoryClick)
    const hasSchedule = !isNewPage && Boolean(onScheduleClick)
    const hasSave = Boolean(onSaveClick)
    const hasPublish = !isNewPage && Boolean(onPublishClick)

    if (!hasHistory && !hasSchedule && !hasSave && !hasPublish) return null

    return (
        <div className="flex items-center gap-1.5">
            {hasHistory && (
                <button
                    type="button"
                    onClick={onHistoryClick}
                    className="flex min-h-9 items-center gap-1 rounded border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                    <History className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">History</span>
                </button>
            )}
            {hasSchedule && (
                <button
                    type="button"
                    onClick={onScheduleClick}
                    className="flex min-h-9 items-center gap-1 rounded border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">Schedule</span>
                </button>
            )}
            {isDirty && onUndoChanges && (
                <button
                    type="button"
                    onClick={onUndoChanges}
                    className="min-h-9 rounded px-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                    Undo
                </button>
            )}
            {hasSave && (
                <button
                    type="button"
                    onClick={onSaveClick}
                    disabled={isSaving || !isDirty}
                    className={`flex min-h-9 items-center gap-1 rounded px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isDirty
                        ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                        : 'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400'
                        }`}
                >
                    {isSaving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : isDirty ? <Save className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    {isSaving ? 'Saving…' : 'Save'}
                </button>
            )}
            {hasPublish && (
                <button
                    type="button"
                    onClick={onPublishClick}
                    disabled={isSaving || !canPublish}
                    className={`flex min-h-9 items-center gap-1 rounded px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${canPublish
                        ? 'bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50'
                        : 'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400'
                        }`}
                >
                    <Upload className="h-3.5 w-3.5" />
                    Publish changes
                </button>
            )}
        </div>
    )
}

export default SaveVersionControl
