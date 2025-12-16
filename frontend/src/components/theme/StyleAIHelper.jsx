/**
 * Style AI Helper Component
 * 
 * AI assistant for generating and modifying theme styles.
 * Maintains conversation context and provides undo functionality.
 */

import React, { useState } from 'react';
import { Sparkles, Send, Undo, Loader } from 'lucide-react';
import { api } from '../../api';

const StyleAIHelper = ({
    themeId,
    styleType,
    currentStyle,
    onUpdateStyle
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [userPrompt, setUserPrompt] = useState('');
    const [contextLog, setContextLog] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [undoStack, setUndoStack] = useState([]);

    const handleSendPrompt = async () => {
        if (!userPrompt.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await api.post(`/api/themes/${themeId}/ai-style-helper/`, {
                styleType,
                userPrompt: userPrompt.trim(),
                currentStyle: {
                    name: currentStyle.name || '',
                    description: currentStyle.description || '',
                    template: currentStyle.template || '',
                    css: currentStyle.css || ''
                },
                contextLog
            });

            const result = response.data;

            // Add user prompt to context
            const newContextLog = [
                ...contextLog,
                { role: 'user', content: userPrompt.trim() }
            ];

            if (result.type === 'question') {
                // LLM needs more info
                setContextLog([
                    ...newContextLog,
                    { role: 'assistant', content: result.question }
                ]);
                setUserPrompt('');
            } else if (result.type === 'result') {
                // LLM returned templates
                // Save current state to undo stack
                setUndoStack([...undoStack, {
                    template: currentStyle.template || '',
                    css: currentStyle.css || ''
                }]);

                // Update templates
                onUpdateStyle({
                    template: result.template,
                    css: result.css
                });

                // Add to context
                setContextLog([
                    ...newContextLog,
                    {
                        role: 'assistant',
                        content: 'Templates updated successfully.'
                    }
                ]);
                setUserPrompt('');
            }

        } catch (err) {
            console.error('AI helper error:', err);
            setError(err.response?.data?.error || 'Failed to generate style');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUndo = () => {
        if (undoStack.length === 0) return;

        const lastState = undoStack[undoStack.length - 1];
        onUpdateStyle({
            template: lastState.template,
            css: lastState.css
        });

        setUndoStack(undoStack.slice(0, -1));
    };

    const handleReset = () => {
        setContextLog([]);
        setUserPrompt('');
        setError(null);
        setUndoStack([]);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
                <Sparkles className="w-4 h-4" />
                AI Helper
            </button>
        );
    }

    return (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <div className="font-semibold text-purple-900" role="heading" aria-level="4">AI Style Helper</div>
                </div>
                <div className="flex items-center gap-2">
                    {undoStack.length > 0 && (
                        <button
                            onClick={handleUndo}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-purple-600 bg-white rounded hover:bg-purple-100"
                            title="Undo last AI change"
                        >
                            <Undo className="w-3 h-3" />
                            Undo ({undoStack.length})
                        </button>
                    )}
                    {contextLog.length > 0 && (
                        <button
                            onClick={handleReset}
                            className="px-3 py-1 text-xs font-medium text-gray-600 bg-white rounded hover:bg-gray-100"
                        >
                            Reset
                        </button>
                    )}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="px-3 py-1 text-xs font-medium text-gray-600 bg-white rounded hover:bg-gray-100"
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Conversation History */}
            {contextLog.length > 0 && (
                <div className="bg-white border border-purple-200 rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
                    {contextLog.map((entry, idx) => (
                        <div
                            key={idx}
                            className={`text-sm ${entry.role === 'user'
                                ? 'text-gray-900 font-medium'
                                : 'text-purple-700 bg-purple-50 p-2 rounded'
                                }`}
                        >
                            <div className="text-xs text-gray-500 mb-1">
                                {entry.role === 'user' ? 'You' : 'AI'}
                            </div>
                            {entry.content}
                        </div>
                    ))}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Input */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendPrompt();
                        }
                    }}
                    placeholder={
                        contextLog.length > 0
                            ? "Continue the conversation..."
                            : `Describe the ${styleType} style you want...`
                    }
                    className="flex-1 px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={isLoading}
                />
                <button
                    onClick={handleSendPrompt}
                    disabled={!userPrompt.trim() || isLoading}
                    className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                </button>
            </div>

            {/* Helper Text */}
            {contextLog.length === 0 && (
                <div className="text-xs text-gray-600">
                    <span className="font-bold">Examples:</span>
                    <div className="mt-1 space-y-1" role="list">
                        {styleType === 'gallery' && (
                            <>
                                <div className="flex items-start gap-1"><span>•</span><span>"Create a masonry gallery with 3 columns"</span></div>
                                <div className="flex items-start gap-1"><span>•</span><span>"Add hover zoom effect to gallery images"</span></div>
                                <div className="flex items-start gap-1"><span>•</span><span>"Make gallery responsive for mobile"</span></div>
                            </>
                        )}
                        {styleType === 'carousel' && (
                            <>
                                <div className="flex items-start gap-1"><span>•</span><span>"Create a hero carousel with fade transitions"</span></div>
                                <div className="flex items-start gap-1"><span>•</span><span>"Add dot navigation below carousel"</span></div>
                                <div className="flex items-start gap-1"><span>•</span><span>"Make carousel auto-play every 5 seconds"</span></div>
                            </>
                        )}
                        {styleType === 'component' && (
                            <>
                                <div className="flex items-start gap-1"><span>•</span><span>"Create a card component with rounded corners"</span></div>
                                <div className="flex items-start gap-1"><span>•</span><span>"Design a modern navigation menu"</span></div>
                                <div className="flex items-start gap-1"><span>•</span><span>"Add shadow on hover to component"</span></div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StyleAIHelper;

