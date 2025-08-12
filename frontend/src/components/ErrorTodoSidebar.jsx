import React from 'react'
import { AlertTriangle, CheckCircle2, ArrowRight, ExternalLink } from 'lucide-react'

/**
 * ErrorTodoSidebar
 * A right-side sidebar listing validation/errors the user must resolve before saving.
 *
 * Props:
 * - items: Array<{ id: string, title: string, detail?: string, hint?: string, target?: { type: string, path?: string }, checked?: boolean }>
 * - onToggle: (id: string, checked: boolean) => void
 * - onNavigate: (item) => void
 * - className?: string
 */
export default function ErrorTodoSidebar({ items = [], onToggle, onNavigate, className = '' }) {
    const unresolvedCount = (items || []).filter((i) => !i.checked).length

    if (!items || items.length === 0) {
        return null
    }

    return (
        <aside className={`w-80 border-l border-gray-200 bg-white flex-shrink-0 h-full overflow-y-auto ${className}`} aria-label="Errors to resolve before saving">
            <div className="p-4">
                <div className="flex items-start space-x-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">Resolve before saving</h3>
                        <p className="text-xs text-gray-600">Fix the issues below, then check them off to enable saving again.</p>
                    </div>
                </div>

                {/* Summary */}
                <div className="text-xs text-gray-700 mb-3">
                    <span className="font-medium">{unresolvedCount}</span> unresolved item{unresolvedCount === 1 ? '' : 's'}
                </div>

                <ul className="space-y-3">
                    {items.map((item) => (
                        <li key={item.id} className={`rounded-md border ${item.checked ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} p-3`}>
                            <div className="flex items-start">
                                <input
                                    id={`todo-${item.id}`}
                                    type="checkbox"
                                    checked={!!item.checked}
                                    onChange={(e) => onToggle && onToggle(item.id, e.target.checked)}
                                    className="mt-1 mr-2 h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                    aria-describedby={`todo-detail-${item.id}`}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between">
                                        <label htmlFor={`todo-${item.id}`} className={`text-sm font-medium ${item.checked ? 'text-green-800' : 'text-red-800'}`}>
                                            {item.title}
                                        </label>
                                        {item.checked ? (
                                            <CheckCircle2 className="w-4 h-4 text-green-600 ml-2" />
                                        ) : null}
                                    </div>
                                    {item.detail && (
                                        <p id={`todo-detail-${item.id}`} className="mt-1 text-xs text-gray-700 break-words">
                                            {item.detail}
                                        </p>
                                    )}
                                    {item.hint && (
                                        <p className="mt-1 text-xs text-gray-600">
                                            <span className="font-medium">How to fix:</span> {item.hint}
                                        </p>
                                    )}
                                    <div className="mt-2 flex items-center space-x-2">
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
                        </li>
                    ))}
                </ul>
            </div>
        </aside>
    )
}


