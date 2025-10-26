/**
 * Table Templates Tab Component
 * 
 * Predefined table templates using TableEditorCore for visual editing
 * and JSON editor for quick copy-paste.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Code, Table as TableIcon, Edit } from 'lucide-react';
import { TableEditorCore } from '../special-editors/TableEditorCore';

const TableTemplatesTab = ({ tableTemplates, onChange }) => {
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [newTemplateKey, setNewTemplateKey] = useState('');
    const [editMode, setEditMode] = useState('visual'); // 'visual' or 'json'

    const templates = tableTemplates || {};
    const templateEntries = Object.entries(templates);

    const handleAddTemplate = () => {
        if (!newTemplateKey.trim()) return;

        const templateKey = newTemplateKey.trim().toLowerCase().replace(/\s+/g, '-');

        if (templates[templateKey]) {
            alert('A template with this name already exists');
            return;
        }

        const newTemplate = {
            name: newTemplateKey,
            rows: [
                {
                    cells: [
                        { content: 'Header 1', fontStyle: 'normal' },
                        { content: 'Header 2', fontStyle: 'normal' },
                    ],
                },
                {
                    cells: [
                        { content: 'Cell 1', fontStyle: 'normal' },
                        { content: 'Cell 2', fontStyle: 'normal' },
                    ],
                },
            ],
            columnWidths: ['auto', 'auto'],
        };

        const updatedTemplates = {
            ...templates,
            [templateKey]: newTemplate,
        };

        onChange(updatedTemplates);
        setNewTemplateKey('');
        setEditingTemplate(templateKey);
    };

    const handleUpdateTemplate = (key, updates) => {
        const updatedTemplates = {
            ...templates,
            [key]: {
                ...templates[key],
                ...updates,
            },
        };
        onChange(updatedTemplates);
    };

    const handleRemoveTemplate = (key) => {
        const updatedTemplates = { ...templates };
        delete updatedTemplates[key];
        onChange(updatedTemplates);
        if (editingTemplate === key) {
            setEditingTemplate(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Table Templates</h3>
            </div>

            <div className="text-sm text-gray-600">
                Create predefined table templates that can be used as starting points in the Table widget.
                Edit visually or use the JSON editor for quick copy-paste.
            </div>

            {/* Add Template Form */}
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Add Table Template</h4>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newTemplateKey}
                        onChange={(e) => setNewTemplateKey(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTemplate();
                        }}
                        placeholder="e.g., simple-header, pricing-table"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="button"
                        onClick={handleAddTemplate}
                        disabled={!newTemplateKey.trim()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                    </button>
                </div>
            </div>

            {/* Templates List */}
            {templateEntries.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Templates sidebar */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Your Templates</h4>
                        {templateEntries.map(([key, template]) => (
                            <div
                                key={key}
                                className={`relative flex items-stretch border rounded-lg transition-colors ${editingTemplate === key
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 bg-white hover:border-gray-300'
                                    }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => setEditingTemplate(key)}
                                    className="flex-1 text-left px-3 py-2 min-w-0"
                                >
                                    <div className="font-medium text-gray-900 truncate">{key}</div>
                                    <div className="text-xs text-gray-500">
                                        {template.rows?.length || 0} rows
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveTemplate(key);
                                    }}
                                    className="px-3 py-2 text-red-600 hover:text-red-700 border-l border-gray-200"
                                    title="Remove template"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Editor panel */}
                    {editingTemplate && templates[editingTemplate] && (
                        <div className="lg:col-span-2">
                            <TableTemplateEditor
                                templateKey={editingTemplate}
                                template={templates[editingTemplate]}
                                editMode={editMode}
                                onEditModeChange={setEditMode}
                                onUpdate={(updates) => handleUpdateTemplate(editingTemplate, updates)}
                            />
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <TableIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-500">
                        No table templates defined. Add a template to get started.
                    </p>
                </div>
            )}
        </div>
    );
};

// Table Template Editor
const TableTemplateEditor = ({ templateKey, template, editMode, onEditModeChange, onUpdate }) => {
    const containerRef = useRef(null);
    const coreRef = useRef(null);
    const [jsonValue, setJsonValue] = useState('');
    const [jsonError, setJsonError] = useState(null);

    // Initialize TableEditorCore for visual mode
    useEffect(() => {
        if (editMode === 'visual' && containerRef.current && !coreRef.current) {
            coreRef.current = new TableEditorCore(template, {
                onChange: (newData) => {
                    onUpdate(newData);
                },
            });
            coreRef.current.render(containerRef.current);
        }

        return () => {
            if (coreRef.current) {
                coreRef.current = null;
            }
        };
    }, [editMode]);

    // Update core when template changes externally
    useEffect(() => {
        if (coreRef.current && editMode === 'visual') {
            coreRef.current.updateTable(template);
        }
    }, [template, editMode]);

    // Sync JSON value when switching to JSON mode
    useEffect(() => {
        if (editMode === 'json') {
            setJsonValue(JSON.stringify(template, null, 2));
            setJsonError(null);
        }
    }, [editMode, template]);

    const handleJsonChange = (value) => {
        setJsonValue(value);
        try {
            const parsed = JSON.parse(value);
            setJsonError(null);
            // Don't update immediately, wait for user to click Apply
        } catch (e) {
            setJsonError(e.message);
        }
    };

    const handleApplyJson = () => {
        try {
            const parsed = JSON.parse(jsonValue);
            onUpdate(parsed);
            setJsonError(null);
        } catch (e) {
            setJsonError(e.message);
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h4 className="font-semibold text-gray-900">{templateKey}</h4>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => onEditModeChange('visual')}
                        className={`px-3 py-1 text-sm font-medium rounded ${editMode === 'visual'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        <Edit className="w-3 h-3 inline mr-1" />
                        Visual
                    </button>
                    <button
                        type="button"
                        onClick={() => onEditModeChange('json')}
                        className={`px-3 py-1 text-sm font-medium rounded ${editMode === 'json'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        <Code className="w-3 h-3 inline mr-1" />
                        JSON
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {editMode === 'visual' ? (
                    <div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Template Name
                            </label>
                            <input
                                type="text"
                                value={template.name || ''}
                                onChange={(e) => onUpdate({ ...template, name: e.target.value })}
                                placeholder="Friendly name for this template"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="border border-gray-300 rounded-lg overflow-hidden">
                            <div
                                ref={containerRef}
                                className="table-editor-container"
                                style={{ minHeight: '300px' }}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                JSON Configuration
                            </label>
                            <textarea
                                value={jsonValue}
                                onChange={(e) => handleJsonChange(e.target.value)}
                                rows={20}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            />
                        </div>

                        {jsonError && (
                            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                                Error: {jsonError}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleApplyJson}
                            disabled={!!jsonError}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Apply Changes
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TableTemplatesTab;

