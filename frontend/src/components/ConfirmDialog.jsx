import Modal from './Modal'
import { AlertTriangle } from 'lucide-react'

const ConfirmDialog = ({
    isOpen,
    onConfirm,
    onCancel,
    title = 'Confirm Action',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmButtonStyle = 'danger' // 'primary', 'danger', 'warning'
}) => {
    const handleConfirm = () => {
        onConfirm()
        onCancel() // Close dialog
    }

    const getConfirmButtonClasses = () => {
        const baseClasses = 'px-4 py-2 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors'

        switch (confirmButtonStyle) {
            case 'primary':
                return `${baseClasses} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500`
            case 'warning':
                return `${baseClasses} bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500`
            default: // danger
                return `${baseClasses} bg-red-600 text-white hover:bg-red-700 focus:ring-red-500`
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
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

                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={handleConfirm}
                            className={getConfirmButtonClasses()}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    )
}

export default ConfirmDialog 