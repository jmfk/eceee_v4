/**
 * Component Style Edit Page (Nested under Theme)
 * 
 * Edit a single component style within a theme context
 * Route: /settings/themes/:themeId/component-styles/:styleKey
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Save, Eye, Copy, Check } from 'lucide-react';
import { themesApi } from '../../api';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import CodeEditorPanel from '../../components/theme/CodeEditorPanel';
import { renderMustache, prepareComponentContext } from '../../utils/mustacheRenderer';
import { scenarios, getScenarioById } from '../../utils/componentStyleScenarios';

const ComponentStyleEditPage = () => {
    const { themeId, styleKey } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { addNotification } = useGlobalNotifications();

    const [template, setTemplate] = useState('');
    const [css, setCss] = useState('');
    const [variables, setVariables] = useState({});
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [initialData, setInitialData] = useState(null);
    const [selectedScenario, setSelectedScenario] = useState('manual-menu');
    const [copyStatus, setCopyStatus] = useState({ template: false, css: false });

    // Fetch theme data
    const { data: themeData, isLoading } = useQuery({
        queryKey: ['theme', themeId],
        queryFn: () => themesApi.get(themeId),
        enabled: !!themeId,
    });

    // Load style data when theme loads
    useEffect(() => {
        if (themeData) {
            const styles = themeData.componentStyles || {};
            const style = styles[styleKey];
            if (style) {
                const initialStyle = {
                    template: style.template || '',
                    css: style.css || '',
                    variables: style.variables || {},
                    name: style.name || styleKey,
                    description: style.description || '',
                };
                setTemplate(initialStyle.template);
                setCss(initialStyle.css);
                setVariables(initialStyle.variables);
                setName(initialStyle.name);
                setDescription(initialStyle.description);
                setInitialData(initialStyle);
            }
        }
    }, [themeData, styleKey]);

    // Check if dirty
    const isDirty = initialData && (
        template !== initialData.template ||
        css !== initialData.css ||
        name !== initialData.name ||
        description !== initialData.description
    );

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: (updatedStyle) => {
            const styles = themeData.componentStyles || {};
            // Exclude image field to avoid file upload error
            const { image, ...themeDataWithoutImage } = themeData;
            return themesApi.update(themeId, {
                ...themeDataWithoutImage,
                componentStyles: {
                    ...styles,
                    [styleKey]: updatedStyle,
                },
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['theme', themeId]);
            queryClient.invalidateQueries(['themes']);
            addNotification({
                type: 'success',
                message: 'Component style saved successfully',
            });
        },
        onError: (error) => {
            addNotification({
                type: 'error',
                message: `Failed to save: ${error.message}`,
            });
        },
    });

    const handleSave = () => {
        updateMutation.mutate({
            name,
            description,
            template,
            css,
            variables,
        });
    };

    const renderPreview = () => {
        try {
            const context = prepareComponentContext(
                '<p>Sample content for preview</p>',
                'Sample Heading',
                variables
            );
            const html = renderMustache(template, context);
            return (
                <div>
                    {css && <style>{css}</style>}
                    <div dangerouslySetInnerHTML={{ __html: html }} />
                </div>
            );
        } catch (error) {
            return <div className="text-red-600 text-sm">Preview error: {error.message}</div>;
        }
    };

    const handleCopyTemplate = async () => {
        const scenario = getScenarioById(selectedScenario);
        try {
            await navigator.clipboard.writeText(scenario.template);
            setTemplate(scenario.template);
            setCopyStatus({ ...copyStatus, template: true });
            addNotification({
                type: 'success',
                message: 'Template copied to editor',
            });
            setTimeout(() => setCopyStatus({ ...copyStatus, template: false }), 2000);
        } catch (error) {
            addNotification({
                type: 'error',
                message: 'Failed to copy template',
            });
        }
    };

    const handleCopyCSS = async () => {
        const scenario = getScenarioById(selectedScenario);
        try {
            await navigator.clipboard.writeText(scenario.css);
            setCss(scenario.css);
            setCopyStatus({ ...copyStatus, css: true });
            addNotification({
                type: 'success',
                message: 'CSS copied to editor',
            });
            setTimeout(() => setCopyStatus({ ...copyStatus, css: false }), 2000);
        } catch (error) {
            addNotification({
                type: 'error',
                message: 'Failed to copy CSS',
            });
        }
    };

    const currentScenario = getScenarioById(selectedScenario);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-gray-600">Loading style...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate(`/settings/themes/${themeId}/component-styles`)}
                                className="inline-flex items-center text-gray-600 hover:text-gray-900"
                            >
                                <ArrowLeft className="w-5 h-5 mr-1" />
                                Back to Component Styles
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">
                                    Edit: {name || styleKey}
                                </h1>
                                <p className="text-sm text-gray-500">
                                    Theme: {themeData?.name}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowPreview(!showPreview)}
                                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                    showPreview 
                                        ? 'bg-gray-600 text-white hover:bg-gray-700'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                <Eye className="w-4 h-4" />
                                Preview
                            </button>
                            <button
                                onClick={() => window.open('/docs/component-styles-reference.html', '_blank')}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                            >
                                <BookOpen className="w-4 h-4" />
                                Documentation
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={updateMutation.isLoading || !isDirty}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="w-4 h-4" />
                                {updateMutation.isLoading ? 'Saving...' : isDirty ? 'Save Style' : 'No Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Editor */}
                    <div className="space-y-6">
                        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
                            {/* Basic Info */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Style Name
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Optional description"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Template Editor */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Mustache Template
                                </label>
                                <div className="mb-2 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                                    <strong>⚠️ Important:</strong> Use triple braces <code className="bg-white px-1 rounded">{'{{{content}}}'}</code> for HTML content!
                                </div>
                                <CodeEditorPanel
                                    data={template}
                                    onChange={setTemplate}
                                    mode="text"
                                />
                            </div>

                            {/* CSS Editor */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    CSS Styles (Optional)
                                </label>
                                <CodeEditorPanel
                                    data={css}
                                    onChange={setCss}
                                    mode="css"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Quick Reference + Preview */}
                    <div className="lg:sticky lg:top-24 h-fit space-y-6">
                        {/* Quick Reference */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">📋 Quick Reference</h4>
                            
                            {/* Scenario Selector */}
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-700 mb-2">
                                    Select Scenario:
                                </label>
                                <select
                                    value={selectedScenario}
                                    onChange={(e) => setSelectedScenario(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                >
                                    {scenarios.map((scenario) => (
                                        <option key={scenario.id} value={scenario.id}>
                                            {scenario.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    {currentScenario.description}
                                </p>
                            </div>

                            <div className="space-y-4 text-sm">
                                {/* Available Variables */}
                                <div>
                                    <p className="font-medium text-gray-700 mb-2">Available Variables:</p>
                                    <div className="space-y-1">
                                        {currentScenario.variables.map((variable) => (
                                            <div key={variable.name} className="flex items-start gap-2">
                                                <code className="px-2 py-1 bg-white rounded text-xs border font-mono">
                                                    {variable.name}
                                                </code>
                                                <span className="text-xs text-gray-600 flex-1">
                                                    <span className="text-gray-400">({variable.type})</span> {variable.description}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Item Properties */}
                                {currentScenario.itemProperties && currentScenario.itemProperties.length > 0 && (
                                    <div>
                                        <p className="font-medium text-gray-700 mb-2">Item Properties:</p>
                                        <div className="space-y-1">
                                            {currentScenario.itemProperties.map((prop) => (
                                                <div key={prop.name} className="flex items-start gap-2">
                                                    <code className="px-2 py-1 bg-white rounded text-xs border font-mono">
                                                        {prop.name}
                                                    </code>
                                                    <span className="text-xs text-gray-600 flex-1">
                                                        <span className="text-gray-400">({prop.type})</span> {prop.description}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Template Example */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="font-medium text-gray-700">HTML Template Example:</p>
                                        <button
                                            onClick={handleCopyTemplate}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                                            title="Copy template to editor"
                                        >
                                            {copyStatus.template ? (
                                                <>
                                                    <Check className="w-3 h-3" />
                                                    Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3 h-3" />
                                                    Copy
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <pre className="bg-white p-3 rounded text-xs overflow-x-auto border font-mono">
                                        {currentScenario.template}
                                    </pre>
                                </div>

                                {/* CSS Example */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="font-medium text-gray-700">CSS Example:</p>
                                        <button
                                            onClick={handleCopyCSS}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                                            title="Copy CSS to editor"
                                        >
                                            {copyStatus.css ? (
                                                <>
                                                    <Check className="w-3 h-3" />
                                                    Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3 h-3" />
                                                    Copy
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <pre className="bg-white p-3 rounded text-xs overflow-x-auto border font-mono">
                                        {currentScenario.css}
                                    </pre>
                                </div>

                                {/* Mustache Syntax Reminder */}
                                <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                                    <strong>⚠️ Important:</strong> Use triple braces <code className="bg-white px-1 rounded">{'{{{content}}}'}</code> for HTML content to avoid escaping!
                                </div>
                            </div>
                        </div>

                        {/* Preview Panel */}
                        {showPreview && (
                            <div className="bg-white border border-gray-200 rounded-lg p-6">
                                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                                    Preview
                                </h3>
                                <div className="border border-gray-300 rounded p-4 bg-gray-50">
                                    {renderPreview()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ComponentStyleEditPage;

