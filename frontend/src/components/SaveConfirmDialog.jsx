import Modal from './Modal'
import { AlertTriangle } from 'lucide-react'

const SaveConfirmDialog = ({
    isOpen,
    onSave,
    onDiscard,
    onCancel,
    title = 'Unsaved Changes',
    message = 'You have unsaved changes. What would you like to do?',
    saveText = 'Save',
    discardText = 'Discard',
    cancelText = 'Abort'
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title={title}
            size="sm"
            showCloseButton={false}
        >
            <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <p className="text-sm text-gray-600 mb-4">{message}</p>
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={onCancel}
                            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onDiscard}
                            className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors"
                        >
                            {discardText}
                        </button>
                        <button
                            onClick={onSave}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                            {saveText}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    )
}

export default SaveConfirmDialog
