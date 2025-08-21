import Modal from './Modal'
import { AlertTriangle, Save, Trash2, X } from 'lucide-react'

const SaveConfirmDialog = ({
    isOpen,
    onSave,
    onDiscard,
    onCancel,
    title = 'Unsaved Changes',
    message = 'You have unsaved changes. What would you like to do?',
    saveText = 'Save Changes',
    discardText = 'Discard Changes',
    cancelText = 'Cancel'
}) => {
    const handleSave = () => {
        onSave()
    }

    const handleDiscard = () => {
        onDiscard()
    }

    const handleCancel = () => {
        onCancel()
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleCancel}
            title={title}
            size="sm"
            showCloseButton={false}
        >
            <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                    <AlertTriangle className="w-8 h-8 text-amber-500" />
                </div>
                <div className="flex-1">
                    <p className="text-gray-700 mb-6">
                        {message}
                    </p>

                    <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors flex items-center justify-center space-x-2"
                        >
                            <X className="w-4 h-4" />
                            <span>{cancelText}</span>
                        </button>
                        <button
                            onClick={handleDiscard}
                            className="px-4 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors flex items-center justify-center space-x-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span>{discardText}</span>
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors flex items-center justify-center space-x-2"
                        >
                            <Save className="w-4 h-4" />
                            <span>{saveText}</span>
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    )
}

export default SaveConfirmDialog
