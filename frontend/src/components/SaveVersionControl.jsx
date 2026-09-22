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
}) => (
    <div className="flex items-center gap-1.5">
        {!isNewPage && (
            <>
                <button
                    type="button"
                    onClick={onHistoryClick}
                    className="flex min-h-9 items-center gap-1 rounded border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                    <History className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">History</span>
                </button>
                <button
                    type="button"
                    onClick={onScheduleClick}
                    className="flex min-h-9 items-center gap-1 rounded border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">Schedule</span>
                </button>
            </>
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
        <button
            type="button"
            onClick={onSaveClick}
            disabled={isSaving}
            className={`flex min-h-9 items-center gap-1 rounded px-3 text-xs font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 ${isDirty ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
        >
            {isSaving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : isDirty ? <Save className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {isSaving ? 'Saving…' : 'Save'}
        </button>
        {!isNewPage && (
            <button
                type="button"
                onClick={onPublishClick}
                disabled={isSaving}
                className="flex min-h-9 items-center gap-1 rounded bg-blue-700 px-3 text-xs font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
            >
                <Upload className="h-3.5 w-3.5" />
                Publish changes
            </button>
        )}
    </div>
)

export default SaveVersionControl
