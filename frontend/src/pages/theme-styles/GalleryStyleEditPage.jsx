/**
 * Gallery Style Edit Page (Nested under Theme)
 * 
 * Edit a single gallery style within a theme context
 * Route: /settings/themes/:themeId/gallery-styles/:styleKey
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Save, Eye, Copy, Check } from 'lucide-react';
import { themesApi } from '../../api';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import CodeEditorPanel from '../../components/theme/CodeEditorPanel';
import { renderMustache, prepareGalleryContext } from '../../utils/mustacheRenderer';
import StyleAIHelper from '../../components/theme/StyleAIHelper';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';
import { galleryScenarios, getGalleryScenarioById } from '../../utils/galleryStyleScenarios';

const GalleryStyleEditPage = () => {
    const { themeId, styleKey } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { addNotification } = useGlobalNotifications();
    const { initTheme, switchTheme, updateThemeField, saveCurrentTheme, getState } = useUnifiedData();

    const [template, setTemplate] = useState('');
    const [css, setCss] = useState('');
    const [variables, setVariables] = useState({});
    const [imgproxyConfig, setImgproxyConfig] = useState({});
    const [lightboxConfig, setLightboxConfig] = useState({});
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [initialData, setInitialData] = useState(null);
    const [newKey, setNewKey] = useState(styleKey);
    const [selectedScenario, setSelectedScenario] = useState('simple-grid');
    const [copyStatus, setCopyStatus] = useState({ template: false, css: false });
    const [isSaving, setIsSaving] = useState(false);
    const [lightboxExpanded, setLightboxExpanded] = useState(false);

    // Fetch theme data
    const { data: themeData, isLoading } = useQuery({
        queryKey: ['theme', themeId],
        queryFn: () => themesApi.get(themeId),
        enabled: !!themeId,
    });

    // Initialize UDC theme if needed and load style data when theme loads
    useEffect(() => {
        if (themeData) {
            // Ensure theme exists in UDC and is current
            try {
                const udcState = getState();
                const idStr = String(themeData.id);
                const hasTheme = !!udcState.themes[idStr];
                if (!hasTheme) {
                    // Map API theme to UDC camelCase structure
                    const themeForUDC = {
                        id: idStr,
                        name: themeData.name || '',
                        description: themeData.description || '',
                        fonts: themeData.fonts || {},
                        colors: themeData.colors || {},
                        typography: themeData.typography || { groups: [] },
                        componentStyles: themeData.componentStyles || {},
                        galleryStyles: themeData.galleryStyles || themeData.gallery_styles || {},
                        carouselStyles: themeData.carouselStyles || themeData.carousel_styles || {},
                        tableTemplates: themeData.tableTemplates || {},
                        image: themeData.image || null,
                        isActive: themeData.isActive ?? true,
                        isDefault: themeData.isDefault ?? false,
                        createdAt: themeData.createdAt || new Date().toISOString(),
                        updatedAt: themeData.updatedAt || new Date().toISOString(),
                        createdBy: themeData.createdBy,
                    };
                    initTheme(idStr, themeForUDC);
                }
                if (udcState.metadata.currentThemeId !== idStr) {
                    switchTheme(idStr);
                }
            } catch (_) {}

            const styles = themeData.gallery_styles || themeData.galleryStyles || {};
            const style = styles[styleKey];
            if (style) {
                const initialStyle = {
                    template: style.template || '',
                    css: style.css || '',
                    variables: style.variables || {},
                    imgproxyConfig: style.imgproxyConfig || {},
                    lightboxConfig: style.lightboxConfig || {},
                    name: style.name || styleKey,
                    description: style.description || '',
                };
                setTemplate(initialStyle.template);
                setCss(initialStyle.css);
                setVariables(initialStyle.variables);
                setImgproxyConfig(initialStyle.imgproxyConfig);
                setLightboxConfig(initialStyle.lightboxConfig);
                setName(initialStyle.name);
                setDescription(initialStyle.description);
                setInitialData(initialStyle);
                setNewKey(styleKey);
            }
        }
    }, [themeData, styleKey]);

    // Check if dirty
    const keyChanged = newKey !== styleKey;
    const isDirty = initialData && (
        template !== initialData.template ||
        css !== initialData.css ||
        name !== initialData.name ||
        description !== initialData.description ||
        JSON.stringify(imgproxyConfig) !== JSON.stringify(initialData.imgproxyConfig) ||
        JSON.stringify(lightboxConfig) !== JSON.stringify(initialData.lightboxConfig) ||
        keyChanged
    );

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
        
        const styles = themeData.gallery_styles || themeData.galleryStyles || {};
        if (sanitizedKey !== styleKey && styles[sanitizedKey]) {
            addNotification({ type: 'error', message: 'A style with this key already exists' });
            return;
        }
        
        // Build updated styles map
        const updatedStyles = { ...styles };
        if (sanitizedKey !== styleKey) {
            delete updatedStyles[styleKey];
        }
        updatedStyles[sanitizedKey] = {
            name,
            description,
            template,
            css,
            variables,
            imgproxyConfig: imgproxyConfig,
            lightboxConfig: lightboxConfig,
        };

        try {
            // Ensure UDC currentThemeId is set
            const udcState = getState();
            if (udcState.metadata.currentThemeId !== String(themeId)) {
                switchTheme(String(themeId));
            }

            // Update UDC and save
            updateThemeField('galleryStyles', updatedStyles, String(themeId));
            setIsSaving(true);
            saveCurrentTheme()
                .then(() => {
                    queryClient.invalidateQueries(['theme', themeId]);
                    queryClient.invalidateQueries(['themes']);
                    addNotification({ type: 'success', message: 'Gallery style saved successfully' });
                    if (sanitizedKey !== styleKey) {
                        navigate(`/settings/themes/${themeId}/gallery-styles/${sanitizedKey}`);
                    }
                })
                .catch((error) => {
                    addNotification({ type: 'error', message: `Failed to save: ${error.message}` });
                })
                .finally(() => setIsSaving(false));
        } catch (error) {
            addNotification({ type: 'error', message: `Failed to save: ${error.message}` });
        }
    };

    // Sample data for preview
    const sampleImages = [
        { url: 'https://via.placeholder.com/400x300', lightboxUrl: 'https://via.placeholder.com/1920x1080', alt_text: 'Sample 1', caption: 'Gallery Image 1', width: 400, height: 300, index: 0 },
        { url: 'https://via.placeholder.com/400x300', lightboxUrl: 'https://via.placeholder.com/1920x1080', alt_text: 'Sample 2', caption: 'Gallery Image 2', width: 400, height: 300, index: 1 },
        { url: 'https://via.placeholder.com/400x300', lightboxUrl: 'https://via.placeholder.com/1920x1080', alt_text: 'Sample 3', caption: 'Gallery Image 3', width: 400, height: 300, index: 2 },
    ];

    const renderPreview = () => {
        try {
            const context = prepareGalleryContext(
                sampleImages,
                { showCaptions: true, enableLightbox: false, lightbox_style: 'default', gallery_group: 'preview' },
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

    const currentScenario = getGalleryScenarioById(selectedScenario);

    const handleCopyTemplate = async () => {
        try {
            await navigator.clipboard.writeText(currentScenario.template);
            setTemplate(currentScenario.template);
            setCopyStatus({ ...copyStatus, template: true });
            addNotification({ type: 'success', message: 'Template copied to editor' });
            setTimeout(() => setCopyStatus({ ...copyStatus, template: false }), 2000);
        } catch (error) {
            addNotification({ type: 'error', message: 'Failed to copy template' });
        }
    };

    const handleCopyCSS = async () => {
        try {
            await navigator.clipboard.writeText(currentScenario.css);
            setCss(currentScenario.css);
            setCopyStatus({ ...copyStatus, css: true });
            addNotification({ type: 'success', message: 'CSS copied to editor' });
            setTimeout(() => setCopyStatus({ ...copyStatus, css: false }), 2000);
        } catch (error) {
            addNotification({ type: 'error', message: 'Failed to copy CSS' });
        }
    };

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
                                onClick={() => navigate(`/settings/themes/${themeId}/gallery-styles`)}
                                className="inline-flex items-center text-gray-600 hover:text-gray-900"
                            >
                                <ArrowLeft className="w-5 h-5 mr-1" />
                                Back to Gallery Styles
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
                                onClick={() => window.open('/docs/gallery-styles-reference.html', '_blank')}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                            >
                                <BookOpen className="w-4 h-4" />
                                Documentation
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !isDirty}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="w-4 h-4" />
                                {isSaving ? 'Saving...' : isDirty ? 'Save Style' : 'No Changes'}
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
                                        onChange={(e) => setName(e.target.value)}
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
                                        onChange={(e) => setNewKey(e.target.value)}
                                        placeholder={name ? name.toLowerCase().replace(/\s+/g, '-') : 'unique-key-name'}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Lowercase letters, numbers, and hyphens only
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

                            {/* AI Helper */}
                            <StyleAIHelper
                                themeId={themeId}
                                styleType="gallery"
                                currentStyle={{
                                    name,
                                    description,
                                    template,
                                    css,
                                }}
                                onUpdateStyle={(updates) => {
                                    if (typeof updates.template === 'string') setTemplate(updates.template);
                                    if (typeof updates.css === 'string') setCss(updates.css);
                                }}
                            />

                            {/* Imgproxy Config */}
                            <div className="bg-blue-50 border border-blue-200 rounded p-4">
                                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                                    Thumbnail Image Processing (imgproxy)
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Width (px)
                                        </label>
                                        <input
                                            type="number"
                                            value={imgproxyConfig.width || ''}
                                            onChange={(e) => setImgproxyConfig({
                                                ...imgproxyConfig,
                                                width: parseInt(e.target.value) || null,
                                            })}
                                            placeholder="800"
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Height (px)
                                        </label>
                                        <input
                                            type="number"
                                            value={imgproxyConfig.height || ''}
                                            onChange={(e) => setImgproxyConfig({
                                                ...imgproxyConfig,
                                                height: parseInt(e.target.value) || null,
                                            })}
                                            placeholder="600"
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Max Width (px)
                                        </label>
                                        <input
                                            type="number"
                                            value={imgproxyConfig.max_width || imgproxyConfig.maxWidth || ''}
                                            onChange={(e) => setImgproxyConfig({
                                                ...imgproxyConfig,
                                                maxWidth: parseInt(e.target.value) || null,
                                            })}
                                            placeholder="1600"
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Prevents upscaling</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Max Height (px)
                                        </label>
                                        <input
                                            type="number"
                                            value={imgproxyConfig.max_height || imgproxyConfig.maxHeight || ''}
                                            onChange={(e) => setImgproxyConfig({
                                                ...imgproxyConfig,
                                                maxHeight: parseInt(e.target.value) || null,
                                            })}
                                            placeholder="1200"
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Prevents upscaling</p>
                                    </div>
                                </div>
                            </div>

                            {/* Template Editor */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Mustache Template
                                </label>
                                <CodeEditorPanel
                                    data={template}
                                    onChange={setTemplate}
                                    mode="text"
                                />
                            </div>

                            {/* CSS Editor */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    CSS Styles
                                </label>
                                <CodeEditorPanel
                                    data={css}
                                    onChange={setCss}
                                    mode="css"
                                />
                            </div>

                            {/* Lightbox Config - Collapsible */}
                            <div className="bg-purple-50 border border-purple-200 rounded-lg overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setLightboxExpanded(!lightboxExpanded)}
                                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-purple-100 transition-colors"
                                >
                                    <h3 className="text-sm font-semibold text-gray-900">
                                        Lightbox Configuration
                                    </h3>
                                    <svg 
                                        className={`w-5 h-5 text-gray-600 transition-transform ${lightboxExpanded ? 'rotate-180' : ''}`}
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                
                                {lightboxExpanded && (
                                    <div className="px-4 pb-4 space-y-4">
                                        {/* Image Sizing Section - First */}
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-800 mb-2">Image Sizing</h4>
                                            <p className="text-xs text-gray-600 mb-3">Configure maximum dimensions for lightbox images</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Width (px)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={lightboxConfig.width || ''}
                                                        onChange={(e) => setLightboxConfig({
                                                            ...lightboxConfig,
                                                            width: parseInt(e.target.value) || null,
                                                        })}
                                                        placeholder="1920"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Height (px)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={lightboxConfig.height || ''}
                                                        onChange={(e) => setLightboxConfig({
                                                            ...lightboxConfig,
                                                            height: parseInt(e.target.value) || null,
                                                        })}
                                                        placeholder="1080"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Max Width (px)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={lightboxConfig.maxWidth || ''}
                                                        onChange={(e) => setLightboxConfig({
                                                            ...lightboxConfig,
                                                            maxWidth: parseInt(e.target.value) || null,
                                                        })}
                                                        placeholder="2560"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Max Height (px)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={lightboxConfig.maxHeight || ''}
                                                        onChange={(e) => setLightboxConfig({
                                                            ...lightboxConfig,
                                                            maxHeight: parseInt(e.target.value) || null,
                                                        })}
                                                        placeholder="1440"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Button Styling Section */}
                                        <div className="pt-4 border-t border-purple-200">
                                            <h4 className="text-xs font-semibold text-gray-800 mb-2">Button Styles</h4>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Button Classes (Tailwind or custom CSS)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={lightboxConfig.buttonClass || ''}
                                                        onChange={(e) => setLightboxConfig({
                                                            ...lightboxConfig,
                                                            buttonClass: e.target.value,
                                                        })}
                                                        placeholder="p-3 rounded-full bg-white/10 hover:bg-white/20"
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded font-mono"
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">Applied to all buttons (close, prev, next)</p>
                                                </div>
                                                
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Close Button HTML (SVG icon)
                                                    </label>
                                                    <textarea
                                                        value={lightboxConfig.closeIcon || ''}
                                                        onChange={(e) => setLightboxConfig({
                                                            ...lightboxConfig,
                                                            closeIcon: e.target.value,
                                                        })}
                                                        placeholder='<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12" /></svg>'
                                                        rows={3}
                                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded font-mono"
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Previous Button HTML (SVG icon)
                                                    </label>
                                                    <textarea
                                                        value={lightboxConfig.prevIcon || ''}
                                                        onChange={(e) => setLightboxConfig({
                                                            ...lightboxConfig,
                                                            prevIcon: e.target.value,
                                                        })}
                                                        placeholder='<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 19l-7-7 7-7" /></svg>'
                                                        rows={3}
                                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded font-mono"
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Next Button HTML (SVG icon)
                                                    </label>
                                                    <textarea
                                                        value={lightboxConfig.nextIcon || ''}
                                                        onChange={(e) => setLightboxConfig({
                                                            ...lightboxConfig,
                                                            nextIcon: e.target.value,
                                                        })}
                                                        placeholder='<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7" /></svg>'
                                                        rows={3}
                                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded font-mono"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Quick Reference + Preview */}
                    <div className="lg:sticky lg:top-24 h-fit space-y-6">
                        {/* Quick Reference with Scenario Selector */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">📋 Quick Reference</h4>

                            {/* Scenario Selector */}
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-700 mb-2">Select Scenario:</label>
                                <select
                                    value={selectedScenario}
                                    onChange={(e) => setSelectedScenario(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                >
                                    {galleryScenarios.map((scenario) => (
                                        <option key={scenario.id} value={scenario.id}>
                                            {scenario.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">{currentScenario.description}</p>
                            </div>

                            <div className="space-y-4 text-sm">
                                {/* Available Variables */}
                                <div>
                                    <p className="font-medium text-gray-700 mb-2">Available Variables:</p>
                                    <div className="space-y-1">
                                        {currentScenario.variables.map((variable) => (
                                            <div key={variable.name} className="flex items-start gap-2">
                                                <code className="px-2 py-1 bg-white rounded text-xs border font-mono">{variable.name}</code>
                                                <span className="text-xs text-gray-600 flex-1">
                                                    <span className="text-gray-400">({variable.type})</span> {variable.description}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Image Properties */}
                                {currentScenario.itemProperties && currentScenario.itemProperties.length > 0 && (
                                    <div>
                                        <p className="font-medium text-gray-700 mb-2">Image Properties:</p>
                                        <div className="space-y-1">
                                            {currentScenario.itemProperties.map((prop) => (
                                                <div key={prop.name} className="flex items-start gap-2">
                                                    <code className="px-2 py-1 bg-white rounded text-xs border font-mono">{prop.name}</code>
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
                                    <pre className="bg-white p-3 rounded text-xs overflow-x-auto border font-mono">{currentScenario.template}</pre>
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
                                    <pre className="bg-white p-3 rounded text-xs overflow-x-auto border font-mono">{currentScenario.css}</pre>
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

export default GalleryStyleEditPage;

