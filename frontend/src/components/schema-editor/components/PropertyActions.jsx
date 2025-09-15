import React from 'react'
import { ChevronUp, ChevronDown, Trash2, Copy } from 'lucide-react'

/**
 * PropertyActions Component
 * 
 * Provides action buttons for property items (move up/down, delete, duplicate).
 */
export default function PropertyActions({
    onMoveUp,
    onMoveDown,
    onDelete,
    onDuplicate,
    canMoveUp = true,
    canMoveDown = true,
    showDuplicate = false
}) {
    return (
        <div className="flex items-center space-x-1">
            {/* Move Up */}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    onMoveUp()
                }}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Move up"
                disabled={!canMoveUp}
            >
                <ChevronUp className="w-4 h-4" />
            </button>

            {/* Move Down */}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    onMoveDown()
                }}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Move down"
                disabled={!canMoveDown}
            >
                <ChevronDown className="w-4 h-4" />
            </button>

            {/* Duplicate */}
            {showDuplicate && onDuplicate && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        onDuplicate()
                    }}
                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    title="Duplicate property"
                >
                    <Copy className="w-4 h-4" />
                </button>
            )}

            {/* Delete */}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                }}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Delete property"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    )
}
