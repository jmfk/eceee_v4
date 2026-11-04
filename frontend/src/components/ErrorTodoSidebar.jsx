import React from 'react'
import { AlertTriangle, ArrowRight, ExternalLink } from 'lucide-react'

/**
 * ErrorTodoSidebar
 * A right-side sidebar listing validation/errors the user must resolve before saving.
 *
 * Props:
 * - items: Array<{ id: string, title: string, detail?: string, hint?: string, target?: { type: string, path?: string } }>
 * - onNavigate: (item) => void
 * - className?: string
 */
export default function ErrorTodoSidebar({ items = [], onNavigate, acknowledgedWarnings = [], onToggleWarning, onSaveAcknowledged, onConvertSlot, isSaving = false, className = '' }) {
    const unresolvedCount = items.length
    const reviewable = items.length > 0 && items.every((item) => item.warning)
    const allAcknowledged = reviewable && items.every((item) => acknowledgedWarnings.includes(item.id))

    if (!items || items.length === 0) {
        return null
    }

    return (
        <aside className={`w-80 border-l border-gray-200 bg-white flex-shrink-0 h-full overflow-y-auto ${className}`} aria-label="Save issues">
            <div className="p-4">
                <div className="flex items-start space-x-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                        <div className="text-sm font-semibold text-gray-900" role="heading" aria-level="3">{reviewable ? 'Content warnings' : 'Save issues'}</div>
                        <div className="text-xs text-gray-600">{reviewable ? 'Review each warning. You can save the draft with these warnings.' : 'Review these issues and try saving again after making changes.'}</div>
                    </div>
                </div>

                {/* Summary */}
                <div className="text-xs text-gray-700 mb-3">
                    <span className="font-medium">{unresolvedCount}</span> unresolved item{unresolvedCount === 1 ? '' : 's'}
                </div>

                <div className="space-y-3" role="list">
                    {items.map((item) => (
                        <div key={item.id} className={`rounded border p-3 ${item.warning ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
                            <div className="flex items-start">
                                {item.warning && <input
                                    type="checkbox"
                                    aria-label={`Acknowledge: ${item.detail || item.title}`}
                                    checked={acknowledgedWarnings.includes(item.id)}
                                    onChange={() => onToggleWarning?.(item.id)}
                                    className="mr-2 mt-0.5"
                                />}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between">
                                        <span className={`text-sm font-medium ${item.warning ? 'text-amber-900' : 'text-red-800'}`}>
                                            {item.title}
                                        </span>
                                    </div>
                                    {item.detail && (
                                        <div id={`todo-detail-${item.id}`} className="mt-1 text-xs text-gray-700 break-words">
                                            {item.detail}
                                        </div>
                                    )}
                                    {item.hint && (
                                        <div className="mt-1 text-xs text-gray-600">
                                            <span className="font-medium">How to fix:</span> {item.hint}
                                        </div>
                                    )}
                                    <div className="mt-2 flex items-center space-x-2">
                                        {item.slotConversion && <button type="button" onClick={() => onConvertSlot?.(item)} className="inline-flex items-center text-xs text-blue-700 hover:text-blue-900 hover:underline">Convert to {item.slotConversion.to}</button>}
                                        {item.target && (
                                            <button
                                                type="button"
                                                onClick={() => onNavigate && onNavigate(item)}
                                                className="inline-flex items-center text-xs text-blue-700 hover:text-blue-900 hover:underline"
                                            >
                                                Go to fix <ArrowRight className="w-3 h-3 ml-1" />
                                            </button>
                                        )}
                                        {item.target?.path?.startsWith('/schemas') && (
                                            <a
                                                href={item.target.path}
                                                className="inline-flex items-center text-xs text-blue-700 hover:text-blue-900 hover:underline"
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Open schema page <ExternalLink className="w-3 h-3 ml-1" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {reviewable && <button
                    type="button"
                    onClick={onSaveAcknowledged}
                    disabled={!allAcknowledged || isSaving}
                    className="mt-4 min-h-8 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >{isSaving ? 'Saving…' : 'Save anyway'}</button>}
            </div>
        </aside>
    )
}


