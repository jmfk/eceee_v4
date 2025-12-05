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
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';
import CodeEditorPanel from '../../components/theme/CodeEditorPanel';
import { renderMustache, prepareComponentContext } from '../../utils/mustacheRenderer';
import { scenarios, getScenarioById } from '../../utils/componentStyleScenarios';
import { migrateLegacyCSS, generateCSSFromBreakpoints, getBreakpointLabel } from '../../utils/cssBreakpointUtils';

const ComponentStyleEditPage = () => {
    const { themeId, styleKey } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { addNotification } = useGlobalNotifications();
    const { setIsDirty } = useUnifiedData();

    const [template, setTemplate] = useState('');
    const [css, setCss] = useState({ default: '' }); // Changed to object for breakpoint support
    const [variables, setVariables] = useState({});
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [initialData, setInitialData] = useState(null);
    const [selectedScenario, setSelectedScenario] = useState('manual-menu');
    const [copyStatus, setCopyStatus] = useState({ template: false, css: false });
    const [newKey, setNewKey] = useState(styleKey);
    const [manualKeyEdit, setManualKeyEdit] = useState(false);
    const [activeBreakpoint, setActiveBreakpoint] = useState('default');

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
                // EDIT MODE: Existing style found
                const cssData = migrateLegacyCSS(style.css || '');

                const initialStyle = {
                    template: style.template || '',
                    css: cssData,
                    variables: style.variables || {},
                    name: style.name || styleKey,
                    description: style.description || '',
                };
                setTemplate(initialStyle.template);
                setCss(cssData);
                setVariables(initialStyle.variables);
                setName(initialStyle.name);
                setDescription(initialStyle.description);
                setInitialData(initialStyle);
                setNewKey(styleKey);
            } else {
                // CREATE MODE: New style being created
                const initialStyle = {
                    template: '',
                    css: { default: '' },
                    variables: {},
                    name: '',
                    description: '',
                };
                setTemplate(initialStyle.template);
                setCss(initialStyle.css);
                setVariables(initialStyle.variables);
                setName(initialStyle.name);
                setDescription(initialStyle.description);
                setInitialData(initialStyle);
                setNewKey(styleKey);
            }
        }
    }, [themeData, styleKey]);

    // Check if dirty
    const keyChanged = newKey !== styleKey;
    const isDirty = !!initialData && (
        template !== initialData.template ||
        JSON.stringify(css) !== JSON.stringify(initialData.css) ||
        JSON.stringify(variables) !== JSON.stringify(initialData.variables) ||
        name !== initialData.name ||
        description !== initialData.description ||
        keyChanged
    );

    // Sync local dirty state to UDC
    useEffect(() => {
        setIsDirty(isDirty);
    }, [isDirty, setIsDirty]);

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ updatedStyle, targetKey }) => {
            const styles = { ...(themeData.componentStyles || {}) };

            // If key changed, delete old key
            if (targetKey !== styleKey) {
                delete styles[styleKey];
            }

            // Set new/updated style
            styles[targetKey] = updatedStyle;

            // Exclude image field to avoid file upload error
            const { image, ...themeDataWithoutImage } = themeData;
            return themesApi.update(themeId, {
                ...themeDataWithoutImage,
                componentStyles: styles,
            });
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries(['theme', themeId]);
            queryClient.invalidateQueries(['themes']);
            addNotification({
                type: 'success',
                message: 'Component style saved successfully',
            });

            // Reset dirty state
            setIsDirty(false);

            // If key changed, navigate to new URL
            if (variables.targetKey !== styleKey) {
                navigate(`/settings/themes/${themeId}/component-styles/${variables.targetKey}`);
            }
        },
        onError: (error) => {
            addNotification({
                type: 'error',
                message: `Failed to save: ${error.message}`,
            });
        },
    });

    const handleSave = () => {
        if (!name.trim()) {
            addNotification({ type: 'error', message: 'Display name is required' });
            return;
        }

        const sanitizedKey = (newKey.trim() || name.trim()).toLowerCase().replace(/\s+/g, '-');

        if (!sanitizedKey) {
            addNotification({ type: 'error', message: 'Key cannot be empty' });
            return;
        }

        const styles = themeData.componentStyles || {};
        if (sanitizedKey !== styleKey && styles[sanitizedKey]) {
            addNotification({ type: 'error', message: 'A style with this key already exists' });
            return;
        }

        updateMutation.mutate({
            updatedStyle: {
                name,
                description,
                template,
                css,
                variables,
            },
            targetKey: sanitizedKey,
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
            // Generate CSS with media queries from breakpoint object
            const generatedCSS = generateCSSFromBreakpoints(css, themeData);
            return (
                <div>
                    {generatedCSS && <style>{generatedCSS}</style>}
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
            // Copy to active breakpoint
            setCss({ ...css, [activeBreakpoint]: scenario.css });
            setCopyStatus({ ...copyStatus, css: true });
            addNotification({
                type: 'success',
                message: `CSS copied to ${activeBreakpoint} breakpoint`,
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
                                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${showPreview
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
                                        Display Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => {
                                            setName(e.target.value);
                                            // Auto-update key if not manually edited
                                            if (!manualKeyEdit) {
                                                const sluggedKey = e.target.value.trim().toLowerCase().replace(/\s+/g, '-');
                                                setNewKey(sluggedKey);
                                            }
                                        }}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Key (Technical Identifier) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newKey}
                                        onChange={(e) => {
                                            setNewKey(e.target.value);
                                            setManualKeyEdit(true);
                                        }}
                                        placeholder={name ? name.toLowerCase().replace(/\s+/g, '-') : 'unique-key-name'}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Auto-generated from display name (edit to customize)
                                    </p>
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

                            {/* CSS Editor with Breakpoints */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    CSS Styles (Optional)
                                </label>

                                {/* Breakpoint Tabs */}
                                <div className="flex gap-1 mb-2 border-b border-gray-200">
                                    {['default', 'sm', 'md', 'lg', 'xl'].map(bp => (
                                        <button
                                            key={bp}
                                            type="button"
                                            onClick={() => setActiveBreakpoint(bp)}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${activeBreakpoint === bp
                                                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                                }`}
                                        >
                                            {getBreakpointLabel(bp, themeData)}
                                        </button>
                                    ))}
                                </div>

                                <CodeEditorPanel
                                    data={css[activeBreakpoint] || ''}
                                    onChange={(value) => setCss({ ...css, [activeBreakpoint]: value })}
                                    mode="css"
                                />

                                <p className="text-xs text-gray-500 mt-2">
                                    💡 Styles cascade: Default applies to all sizes, then each breakpoint overrides at min-width.
                                </p>
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
                                    Live Preview
                                </h3>
                                <style dangerouslySetInnerHTML={{ __html: css }} />
                                <div className="border border-gray-300 rounded p-4 bg-gray-50 overflow-auto">
                                    <div dangerouslySetInnerHTML={{ __html: renderPreview() }} />
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

