/**
 * Image Style Edit Page (Nested under Theme)
 * 
 * Edit a single image style (gallery or carousel) within a theme context
 * Route: /settings/themes/:themeId/image-styles/:styleKey
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Save, Eye, Copy, Check, Grid3X3, Play } from 'lucide-react';
import { themesApi } from '../../api';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import CodeEditorPanel from '../../components/theme/CodeEditorPanel';
import { renderMustache, prepareGalleryContext, prepareCarouselContext } from '../../utils/mustacheRenderer';
import StyleAIHelper from '../../components/theme/StyleAIHelper';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';
import { imageStyleScenarios, getScenarioById, getScenariosByType } from '../../utils/imageStyleScenarios';
import { migrateLegacyCSS, generateCSSFromBreakpoints, getBreakpointLabel } from '../../utils/cssBreakpointUtils';

const ImageStyleEditPage = () => {
    const { themeId, styleKey } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { addNotification } = useGlobalNotifications();
    const { initTheme, switchTheme, updateThemeField, saveCurrentTheme, getState } = useUnifiedData();

    const [template, setTemplate] = useState('');
    const [css, setCss] = useState({ default: '' }); // Changed to object for breakpoint support
    const [variables, setVariables] = useState({});
    const [imgproxyConfig, setImgproxyConfig] = useState({});
    const [lightboxConfig, setLightboxConfig] = useState({});
    const [styleType, setStyleType] = useState('gallery');
    const [usageType, setUsageType] = useState('both');
    const [alpine, setAlpine] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [initialData, setInitialData] = useState(null);
    const [newKey, setNewKey] = useState(styleKey);
    const [manualKeyEdit, setManualKeyEdit] = useState(false);
    const [selectedScenario, setSelectedScenario] = useState('simple-grid');
    const [copyStatus, setCopyStatus] = useState({ template: false, css: false });
    const [isSaving, setIsSaving] = useState(false);
    const [lightboxExpanded, setLightboxExpanded] = useState(false);
    const [activeBreakpoint, setActiveBreakpoint] = useState('default');
    
    // New lightbox and default settings
    const [enableLightbox, setEnableLightbox] = useState(true);
    const [lightboxTemplate, setLightboxTemplate] = useState('');
    const [defaultShowCaptions, setDefaultShowCaptions] = useState(true);
    const [defaultLightboxGroup, setDefaultLightboxGroup] = useState('');
    const [defaultRandomize, setDefaultRandomize] = useState(false);
    const [defaultAutoPlay, setDefaultAutoPlay] = useState(false);
    const [defaultAutoPlayInterval, setDefaultAutoPlayInterval] = useState(3);

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
                        designGroups: themeData.designGroups || { groups: [] },
                        componentStyles: themeData.componentStyles || {},
                        imageStyles: themeData.imageStyles || themeData.image_styles || {},
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

            const styles = themeData.image_styles || themeData.imageStyles || {};
            const style = styles[styleKey];
            if (style) {
                // Migrate legacy string CSS to object format
                const cssData = migrateLegacyCSS(style.css || '');
                
                const initialStyle = {
                    template: style.template || '',
                    css: cssData,
                    variables: style.variables || {},
                    imgproxyConfig: style.imgproxyConfig || {},
                    lightboxConfig: style.lightboxConfig || {},
                    styleType: style.styleType || 'gallery',
                    usageType: style.usageType || 'both',
                    alpine: style.alpine || false,
                    name: style.name || styleKey,
                    description: style.description || '',
                    enableLightbox: style.enableLightbox !== undefined ? style.enableLightbox : true,
                    lightboxTemplate: style.lightboxTemplate || '',
                    defaultShowCaptions: style.defaultShowCaptions !== undefined ? style.defaultShowCaptions : true,
                    defaultLightboxGroup: style.defaultLightboxGroup || '',
                    defaultRandomize: style.defaultRandomize || false,
                    defaultAutoPlay: style.defaultAutoPlay || false,
                    defaultAutoPlayInterval: style.defaultAutoPlayInterval || 3,
                };
                setTemplate(initialStyle.template);
                setCss(cssData);
                setVariables(initialStyle.variables);
                setImgproxyConfig(initialStyle.imgproxyConfig);
                setLightboxConfig(initialStyle.lightboxConfig);
                setStyleType(initialStyle.styleType);
                setUsageType(initialStyle.usageType);
                setAlpine(initialStyle.alpine);
                setName(initialStyle.name);
                setDescription(initialStyle.description);
                setEnableLightbox(initialStyle.enableLightbox);
                setLightboxTemplate(initialStyle.lightboxTemplate);
                setDefaultShowCaptions(initialStyle.defaultShowCaptions);
                setDefaultLightboxGroup(initialStyle.defaultLightboxGroup);
                setDefaultRandomize(initialStyle.defaultRandomize);
                setDefaultAutoPlay(initialStyle.defaultAutoPlay);
                setDefaultAutoPlayInterval(initialStyle.defaultAutoPlayInterval);
                setInitialData(initialStyle);
                setNewKey(styleKey);
            }
        }
    }, [themeData, styleKey]);

    // Check if dirty
    const keyChanged = newKey !== styleKey;
    const isDirty = initialData && (
        template !== initialData.template ||
        JSON.stringify(css) !== JSON.stringify(initialData.css) ||
        name !== initialData.name ||
        description !== initialData.description ||
        styleType !== initialData.styleType ||
        usageType !== initialData.usageType ||
        alpine !== initialData.alpine ||
        enableLightbox !== initialData.enableLightbox ||
        lightboxTemplate !== initialData.lightboxTemplate ||
        defaultShowCaptions !== initialData.defaultShowCaptions ||
        defaultLightboxGroup !== initialData.defaultLightboxGroup ||
        defaultRandomize !== initialData.defaultRandomize ||
        defaultAutoPlay !== initialData.defaultAutoPlay ||
        defaultAutoPlayInterval !== initialData.defaultAutoPlayInterval ||
        JSON.stringify(imgproxyConfig) !== JSON.stringify(initialData.imgproxyConfig) ||
        JSON.stringify(lightboxConfig) !== JSON.stringify(initialData.lightboxConfig) ||
        keyChanged
    );

    const handleSave = async () => {
        if (!name.trim()) {
            addNotification({ type: 'error', message: 'Display name is required' });
            return;
        }
        
        const sanitizedKey = (newKey.trim() || name.trim()).toLowerCase().replace(/\s+/g, '-');
        
        if (!sanitizedKey) {
            addNotification({ type: 'error', message: 'Key cannot be empty' });
            return;
        }
        
        const styles = themeData.image_styles || themeData.imageStyles || {};
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
            imgproxyConfig,
            lightboxConfig,
            styleType,
            usageType,
            alpine,
            enableLightbox,
            lightboxTemplate,
            defaultShowCaptions,
            defaultLightboxGroup,
            defaultRandomize,
            ...(styleType === 'carousel' ? {
                defaultAutoPlay,
                defaultAutoPlayInterval,
            } : {}),
        };
        
        setIsSaving(true);
        
        try {
            const udcState = getState();
            if (udcState.metadata.currentThemeId !== String(themeId)) {
                switchTheme(String(themeId));
            }
            
            updateThemeField('imageStyles', updatedStyles);
            
            await saveCurrentTheme();
            
            queryClient.invalidateQueries(['theme', themeId]);
            addNotification({ type: 'success', message: 'Image style saved' });
            
            // Update initial data to match saved state
            const newInitialData = {
                template,
                css,
                variables,
                imgproxyConfig,
                lightboxConfig,
                styleType,
                usageType,
                alpine,
                enableLightbox,
                lightboxTemplate,
                defaultShowCaptions,
                defaultLightboxGroup,
                defaultRandomize,
                defaultAutoPlay,
                defaultAutoPlayInterval,
                name,
                description,
            };
            setInitialData(newInitialData);
            
            if (sanitizedKey !== styleKey) {
                navigate(`/settings/themes/${themeId}/image-styles/${sanitizedKey}`, { replace: true });
            }
        } catch (error) {
            addNotification({ type: 'error', message: 'Failed to save image style' });
        } finally {
            setIsSaving(false);
        }
    };

    // Sample data for preview
    const sampleImages = [
        { url: 'https://via.placeholder.com/800x600', alt: 'Sample 1', caption: 'Image Caption 1', width: 800, height: 600 },
        { url: 'https://via.placeholder.com/800x600', alt: 'Sample 2', caption: 'Image Caption 2', width: 800, height: 600 },
        { url: 'https://via.placeholder.com/800x600', alt: 'Sample 3', caption: 'Image Caption 3', width: 800, height: 600 }
    ];

    const handleCopyTemplate = async () => {
        const scenario = getScenarioById(selectedScenario);
        try {
            await navigator.clipboard.writeText(scenario.template);
            setTemplate(scenario.template);
            setCopyStatus({ ...copyStatus, template: true });
            addNotification({ type: 'success', message: 'Template copied to editor' });
            setTimeout(() => setCopyStatus({ ...copyStatus, template: false }), 2000);
        } catch (error) {
            addNotification({ type: 'error', message: 'Failed to copy template' });
        }
    };

    const handleCopyCSS = async () => {
        const scenario = getScenarioById(selectedScenario);
        try {
            await navigator.clipboard.writeText(scenario.css);
            setCss(scenario.css);
            setCopyStatus({ ...copyStatus, css: true });
            addNotification({ type: 'success', message: 'CSS copied to editor' });
            setTimeout(() => setCopyStatus({ ...copyStatus, css: false }), 2000);
        } catch (error) {
            addNotification({ type: 'error', message: 'Failed to copy CSS' });
        }
    };

    const currentScenario = getScenarioById(selectedScenario);
    
    // Filter scenarios by current styleType
    const availableScenarios = getScenariosByType(styleType);
    
    // Update selected scenario when styleType changes
    useEffect(() => {
        if (availableScenarios.length > 0 && !availableScenarios.find(s => s.id === selectedScenario)) {
            setSelectedScenario(availableScenarios[0].id);
        }
    }, [styleType, availableScenarios, selectedScenario]);

    const previewHTML = () => {
        if (!template) return '';
        
        try {
            const context = styleType === 'carousel'
                ? prepareCarouselContext(sampleImages, { showCaptions: true }, variables, imgproxyConfig)
                : prepareGalleryContext(sampleImages, { showCaptions: true }, variables, imgproxyConfig, lightboxConfig);
            
            return renderMustache(template, context);
        } catch (error) {
            return `<div class="error">Preview error: ${error.message}</div>`;
        }
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen">Loading...</div>;
    }

    if (!themeData) {
        return <div className="flex items-center justify-center h-screen">Theme not found</div>;
    }

    const handleBack = () => {
        if (isDirty) {
            if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
                navigate(`/settings/themes/${themeId}/image-styles`);
            }
        } else {
            navigate(`/settings/themes/${themeId}/image-styles`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleBack}
                                className="p-2 hover:bg-gray-100 rounded-lg transition"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    {styleType === 'carousel' ? (
                                        <Play className="h-6 w-6 text-purple-600" />
                                    ) : (
                                        <Grid3X3 className="h-6 w-6 text-blue-600" />
                                    )}
                                    {name || styleKey}
                                </h1>
                                <p className="text-sm text-gray-600 mt-1">
                                    Theme: {themeData.name} · Type: {styleType === 'carousel' ? 'Carousel' : 'Gallery'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => window.open('/docs/image-styles-reference.html', '_blank')}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                title="Open Documentation"
                            >
                                <BookOpen className="h-4 w-4" />
                                Docs
                            </button>
                            <button
                                onClick={() => setShowPreview(!showPreview)}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                            >
                                <Eye className="h-4 w-4" />
                                {showPreview ? 'Hide' : 'Show'} Preview
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!isDirty || isSaving}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="h-4 w-4" />
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Settings */}
                    <div className="space-y-6">
                        {/* Basic Info */}
                        <div className="bg-white rounded-lg border p-6">
                            <h3 className="font-semibold text-gray-900 mb-4">Basic Information</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Display Name *
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
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="My Image Style"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Key
                                    </label>
                                    <input
                                        type="text"
                                        value={newKey}
                                        onChange={(e) => {
                                            setNewKey(e.target.value);
                                            setManualKeyEdit(true);
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                        placeholder="my-image-style"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Auto-generated from display name (edit to customize)
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={2}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Optional description"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Style Type *
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setStyleType('gallery')}
                                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 border rounded-lg transition ${
                                                styleType === 'gallery'
                                                    ? 'bg-blue-50 border-blue-600 text-blue-700'
                                                    : 'border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            <Grid3X3 className="h-4 w-4" />
                                            Gallery
                                        </button>
                                        <button
                                            onClick={() => setStyleType('carousel')}
                                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 border rounded-lg transition ${
                                                styleType === 'carousel'
                                                    ? 'bg-purple-50 border-purple-600 text-purple-700'
                                                    : 'border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            <Play className="h-4 w-4" />
                                            Carousel
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Usage Type *
                                    </label>
                                    <select
                                        value={usageType}
                                        onChange={(e) => setUsageType(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="both">Both (Standard & Inline)</option>
                                        <option value="standard">Standard Images Only</option>
                                        <option value="inline">Inline Images Only</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Controls where this style can be used
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="alpine"
                                        checked={alpine}
                                        onChange={(e) => setAlpine(e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor="alpine" className="text-sm text-gray-700">
                                        Uses Alpine.js
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Image Processing (imgproxy) */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                            <h3 className="font-semibold text-gray-900 mb-4">Thumbnail Image Processing (imgproxy)</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Width (px)
                                    </label>
                                    <input
                                        type="number"
                                        value={imgproxyConfig.width || ''}
                                        onChange={(e) => setImgproxyConfig({ ...imgproxyConfig, width: parseInt(e.target.value) || null })}
                                        placeholder="800"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Height (px)
                                    </label>
                                    <input
                                        type="number"
                                        value={imgproxyConfig.height || ''}
                                        onChange={(e) => setImgproxyConfig({ ...imgproxyConfig, height: parseInt(e.target.value) || null })}
                                        placeholder="600"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Max Width (px)
                                    </label>
                                    <input
                                        type="number"
                                        value={imgproxyConfig.max_width || imgproxyConfig.maxWidth || ''}
                                        onChange={(e) => setImgproxyConfig({ ...imgproxyConfig, maxWidth: parseInt(e.target.value) || null })}
                                        placeholder="1600"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Prevents upscaling</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Max Height (px)
                                    </label>
                                    <input
                                        type="number"
                                        value={imgproxyConfig.max_height || imgproxyConfig.maxHeight || ''}
                                        onChange={(e) => setImgproxyConfig({ ...imgproxyConfig, maxHeight: parseInt(e.target.value) || null })}
                                        placeholder="1200"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Prevents upscaling</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Resize Type
                                    </label>
                                    <select
                                        value={imgproxyConfig.resizeType || imgproxyConfig.resize_type || ''}
                                        onChange={(e) => setImgproxyConfig({ ...imgproxyConfig, resizeType: e.target.value || null })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Default</option>
                                        <option value="fit">Fit (preserve aspect)</option>
                                        <option value="fill">Fill (crop if needed)</option>
                                        <option value="auto">Auto</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Gravity
                                    </label>
                                    <select
                                        value={imgproxyConfig.gravity || ''}
                                        onChange={(e) => setImgproxyConfig({ ...imgproxyConfig, gravity: e.target.value || null })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Default</option>
                                        <option value="sm">Smart (detect subject)</option>
                                        <option value="ce">Center</option>
                                        <option value="no">North</option>
                                        <option value="so">South</option>
                                        <option value="ea">East</option>
                                        <option value="we">West</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Lightbox Settings */}
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                            <h3 className="font-semibold text-gray-900 mb-4">Lightbox Settings</h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="enableLightbox"
                                        checked={enableLightbox}
                                        onChange={(e) => setEnableLightbox(e.target.checked)}
                                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <label htmlFor="enableLightbox" className="text-sm font-medium text-gray-700">
                                        Enable Lightbox
                                    </label>
                                </div>
                                {enableLightbox && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Lightbox Template (Optional)
                                        </label>
                                        <textarea
                                            value={lightboxTemplate}
                                            onChange={(e) => setLightboxTemplate(e.target.value)}
                                            rows={4}
                                            placeholder="Custom Mustache template for lightbox UI"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Leave empty to use default lightbox
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Default Values */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                            <h3 className="font-semibold text-gray-900 mb-4">Default Values</h3>
                            <p className="text-xs text-gray-600 mb-4">
                                These defaults can be overridden by individual widgets
                            </p>
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="defaultShowCaptions"
                                        checked={defaultShowCaptions}
                                        onChange={(e) => setDefaultShowCaptions(e.target.checked)}
                                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    />
                                    <label htmlFor="defaultShowCaptions" className="text-sm text-gray-700">
                                        Show Captions
                                    </label>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Lightbox Group (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={defaultLightboxGroup}
                                        onChange={(e) => setDefaultLightboxGroup(e.target.value)}
                                        placeholder="my-gallery"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Group images for lightbox navigation
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="defaultRandomize"
                                        checked={defaultRandomize}
                                        onChange={(e) => setDefaultRandomize(e.target.checked)}
                                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    />
                                    <label htmlFor="defaultRandomize" className="text-sm text-gray-700">
                                        Randomize Image Order
                                    </label>
                                </div>
                                {styleType === 'carousel' && (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="defaultAutoPlay"
                                                checked={defaultAutoPlay}
                                                onChange={(e) => setDefaultAutoPlay(e.target.checked)}
                                                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                            />
                                            <label htmlFor="defaultAutoPlay" className="text-sm text-gray-700">
                                                Auto Play
                                            </label>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Auto Play Interval (seconds)
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="30"
                                                value={defaultAutoPlayInterval}
                                                onChange={(e) => setDefaultAutoPlayInterval(parseInt(e.target.value) || 3)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Template Editor */}
                        <div className="bg-white rounded-lg border p-6">
                            <h3 className="font-semibold text-gray-900 mb-4">Mustache Template</h3>
                            <textarea
                                value={template}
                                onChange={(e) => setTemplate(e.target.value)}
                                rows={12}
                                placeholder="<div>{{#images}}...{{/images}}</div>"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                            />
                        </div>

                        {/* CSS Editor with Breakpoints */}
                        <div className="bg-white rounded-lg border p-6">
                            <h3 className="font-semibold text-gray-900 mb-4">CSS Styles</h3>
                            
                            {/* Breakpoint Tabs */}
                            <div className="flex gap-1 mb-2 border-b border-gray-200">
                                {['default', 'sm', 'md', 'lg', 'xl'].map(bp => (
                                    <button
                                        key={bp}
                                        type="button"
                                        onClick={() => setActiveBreakpoint(bp)}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
                                            activeBreakpoint === bp
                                                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                    >
                                        {getBreakpointLabel(bp, themeData)}
                                    </button>
                                ))}
                            </div>
                            
                            <textarea
                                value={css[activeBreakpoint] || ''}
                                onChange={(e) => setCss({ ...css, [activeBreakpoint]: e.target.value })}
                                rows={12}
                                placeholder=".my-style { }"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                            />
                            
                            <p className="text-xs text-gray-500 mt-2">
                                💡 Styles cascade: Default applies to all sizes, then each breakpoint overrides at min-width.
                            </p>
                        </div>
                    </div>

                    {/* Right Column - Quick Reference & Preview */}
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
                                    {availableScenarios.map((scenario) => (
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
                                                    ({variable.type}) {variable.description}
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
                                                        ({prop.type}) {prop.description}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Template Example */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="font-medium text-gray-700">Template Example:</p>
                                        <button
                                            onClick={handleCopyTemplate}
                                            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                                        >
                                            {copyStatus.template ? (
                                                <>
                                                    <Check className="h-3 w-3" />
                                                    Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="h-3 w-3" />
                                                    Copy to Editor
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
                                            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                                        >
                                            {copyStatus.css ? (
                                                <>
                                                    <Check className="h-3 w-3" />
                                                    Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="h-3 w-3" />
                                                    Copy to Editor
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
                                    <strong>Mustache Tip:</strong> Use &#123;&#123;#variable&#125;&#125;...&#123;&#123;/variable&#125;&#125; for loops/conditionals
                                </div>
                            </div>
                        </div>

                        {/* Preview */}
                        {showPreview && (
                            <div className="bg-white rounded-lg border p-6">
                                <h3 className="font-semibold text-gray-900 mb-4">Live Preview</h3>
                                <style dangerouslySetInnerHTML={{ __html: css }} />
                                <div className="border rounded p-4 bg-gray-50 overflow-auto">
                                    <div dangerouslySetInnerHTML={{ __html: previewHTML() }} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
};

export default ImageStyleEditPage;

