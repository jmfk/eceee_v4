/**
 * Code Editor Panel Component
 * 
 * Reusable component for viewing/editing data as JSON, CSS, or text.
 * Includes Copy/Paste/Cut functionality.
 */

import React, { useState, useEffect } from 'react';
import { Code, FileJson, FileCode, Copy, Clipboard, Scissors, Check, AlertCircle } from 'lucide-react';

const CodeEditorPanel = ({
    data,
    onChange,
    mode = 'json', // 'json', 'css', or 'text'
    label = 'Code',
    readOnly = false,
    generateCSS = null, // Optional function to generate CSS from data
    className = '',
}) => {
    const [editorValue, setEditorValue] = useState('');
    const [error, setError] = useState(null);
    const [copySuccess, setCopySuccess] = useState(false);

    // Update editor value when data changes
    useEffect(() => {
        if (mode === 'json') {
            setEditorValue(JSON.stringify(data, null, 2));
        } else if (mode === 'css' && generateCSS) {
            setEditorValue(generateCSS(data));
        } else {
            setEditorValue(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
        }
        setError(null);
    }, [data, mode, generateCSS]);

    const handleEditorChange = (value) => {
        setEditorValue(value);

        if (mode === 'json') {
            try {
                const parsed = JSON.parse(value);
                setError(null);
                if (!readOnly && onChange) {
                    onChange(parsed);
                }
            } catch (e) {
                setError(e.message);
            }
        } else {
            setError(null);
            if (!readOnly && onChange) {
                onChange(value);
            }
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(editorValue);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setEditorValue(text);

            if (mode === 'json') {
                try {
                    const parsed = JSON.parse(text);
                    setError(null);
                    if (onChange) {
                        onChange(parsed);
                    }
                } catch (e) {
                    setError(`Invalid JSON: ${e.message}`);
                }
            } else {
                setError(null);
                if (onChange) {
                    onChange(text);
                }
            }
        } catch (err) {
            console.error('Failed to paste:', err);
        }
    };

    const handleCut = async () => {
        await handleCopy();
        if (!readOnly && onChange) {
            if (mode === 'json') {
                onChange({});
                setEditorValue('{}');
            } else {
                onChange('');
                setEditorValue('');
            }
        }
    };

    const getModeIcon = () => {
        switch (mode) {
            case 'json':
                return <FileJson className="w-4 h-4" />;
            case 'css':
                return <FileCode className="w-4 h-4" />;
            default:
                return <Code className="w-4 h-4" />;
        }
    };

    return (
        <div className={`space-y-2 ${className}`}>
            {/* Header with actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    {getModeIcon()}
                    <span>{label}</span>
                    {mode === 'css' && readOnly && (
                        <span className="text-xs text-gray-500">(Preview Only)</span>
                    )}
                </div>

                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                        title="Copy to clipboard"
                    >
                        {copySuccess ? (
                            <>
                                <Check className="w-3 h-3 mr-1 text-green-600" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Copy className="w-3 h-3 mr-1" />
                                Copy
                            </>
                        )}
                    </button>

                    {!readOnly && (
                        <>
                            <button
                                type="button"
                                onClick={handlePaste}
                                className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                                title="Paste from clipboard"
                            >
                                <Clipboard className="w-3 h-3 mr-1" />
                                Paste
                            </button>

                            <button
                                type="button"
                                onClick={handleCut}
                                className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                                title="Cut to clipboard"
                            >
                                <Scissors className="w-3 h-3 mr-1" />
                                Cut
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Editor */}
            <textarea
                value={editorValue}
                onChange={(e) => handleEditorChange(e.target.value)}
                readOnly={readOnly || mode === 'css'}
                rows={12}
                className={`w-full px-3 py-2 border rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    } ${readOnly || mode === 'css' ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}`}
            />

            {/* Error Display */}
            {error && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

export default CodeEditorPanel;

