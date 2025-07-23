import { useState, useEffect } from 'react'
import Modal from './Modal'
import { MessageCircle } from 'lucide-react'

const PromptDialog = ({
    isOpen,
    onSubmit,
    onCancel,
    title = 'Enter Information',
    message,
    placeholder = '',
    defaultValue = '',
    submitText = 'OK',
    cancelText = 'Cancel',
    required = false
}) => {
    const [value, setValue] = useState(defaultValue)

    // Reset value when dialog opens
    useEffect(() => {
        if (isOpen) {
            setValue(defaultValue)
        }
    }, [isOpen, defaultValue])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (required && !value.trim()) {
            return // Don't submit if required and empty
        }
        onSubmit(value)
        onCancel() // Close dialog
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
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
                    <MessageCircle className="w-8 h-8 text-blue-500" />
                </div>
                <div className="flex-1">
                    {message && (
                        <p className="text-gray-700 mb-4">
                            {message}
                        </p>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="mb-6">
                            <input
                                type="text"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={placeholder}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                autoFocus
                                required={required}
                            />
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                            >
                                {cancelText}
                            </button>
                            <button
                                type="submit"
                                disabled={required && !value.trim()}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitText}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Modal>
    )
}

export default PromptDialog 