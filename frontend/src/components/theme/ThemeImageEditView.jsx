import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Image as ImageIcon, Link2, Loader2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { themesApi } from '../../api/themes';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import { useWidgets } from '../../hooks/useWidgets';
import { calculateSelectorsForGroup } from '../../utils/selectorCalculation';
import OptimizedImage from '../media/OptimizedImage';

const BREAKPOINT_OPTIONS = ['xs', 'sm', 'md', 'lg', 'xl'];

const getThemeDesignGroups = (theme) => theme?.designGroups || theme?.typography || { groups: [] };
const getWidgetLayoutParts = (widget) => widget?.layoutParts || widget?.layout_parts || {};

const referencesImage = (value, filename) => {
    if (!value || !filename) return false;
    if (typeof value === 'string') return value.includes(filename);
    if (typeof value === 'object') {
        return value.filename === filename ||
            value.url?.includes(filename) ||
            value.fileUrl?.includes(filename) ||
            value.publicUrl?.includes(filename) ||
            value.imgproxyBaseUrl?.includes(filename);
    }
    return false;
};

const getImageAssignments = (theme, filename) => {
    const designGroups = getThemeDesignGroups(theme);
    const assignments = [];

    (designGroups.groups || []).forEach((group, groupIndex) => {
        Object.entries(group.layoutProperties || {}).forEach(([part, breakpoints]) => {
            Object.entries(breakpoints || {}).forEach(([breakpoint, props]) => {
                if (!props || typeof props !== 'object') return;

                Object.entries(props).forEach(([property, value]) => {
                    if (property === 'images' || !referencesImage(value, filename)) return;
                    assignments.push({
                        groupIndex,
                        groupName: group.name || `Group ${groupIndex + 1}`,
                        widgetTypes: group.widgetTypes || (group.widgetType ? [group.widgetType] : []),
                        part,
                        breakpoint,
                        property,
                        legacyImagesMap: false,
                    });
                });

                Object.entries(props.images || {}).forEach(([property, value]) => {
                    if (!referencesImage(value, filename)) return;
                    assignments.push({
                        groupIndex,
                        groupName: group.name || `Group ${groupIndex + 1}`,
                        widgetTypes: group.widgetTypes || (group.widgetType ? [group.widgetType] : []),
                        part,
                        breakpoint,
                        property,
                        legacyImagesMap: true,
                    });
                });
            });
        });
    });

    return assignments;
};

const getAssignableWidgetTypes = (widgetTypes) => {
    return widgetTypes.filter(widget => {
        const layoutParts = getWidgetLayoutParts(widget);
        return Object.values(layoutParts).some(part => {
            const properties = part.properties;
            return !properties || properties.includes('backgroundImage');
        });
    });
};

const getAssignableParts = (widget) => {
    return Object.entries(getWidgetLayoutParts(widget))
        .filter(([, part]) => !part.properties || part.properties.includes('backgroundImage'))
        .map(([id, part]) => ({
            id,
            label: part.label || id.replace(/[-_]/g, ' '),
        }));
};

const formatWidgetName = (widgetType, widgetTypes) => {
    return widgetTypes.find(widget => widget.type === widgetType)?.name || widgetType?.split('.').pop() || widgetType || 'Any widget';
};

const formatPartName = (part, widgetType, widgetTypes) => {
    const widget = widgetTypes.find(item => item.type === widgetType);
    return getWidgetLayoutParts(widget)?.[part]?.label || part.replace(/[-_]/g, ' ');
};

const ThemeImageEditView = ({
    themeId,
    imageFilename,
    theme,
    onDesignGroupsChange,
    onDirty,
}) => {
    const navigate = useNavigate();
    const { addNotification } = useGlobalNotifications();
    const { widgetTypes } = useWidgets();
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const decodedFilename = decodeURIComponent(imageFilename || '');

    const designGroups = getThemeDesignGroups(theme);
    const groups = designGroups.groups || [];
    const assignments = getImageAssignments(theme, decodedFilename);
    const image = images.find(item => item.filename === decodedFilename);
    const assignableWidgetTypes = useMemo(() => getAssignableWidgetTypes(widgetTypes), [widgetTypes]);

    const [settings, setSettings] = useState({
        groupIndex: '__new__',
        widgetType: '',
        part: '',
        breakpoint: 'sm',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
    });

    const selectedWidget = assignableWidgetTypes.find(widget => widget.type === settings.widgetType);
    const availableParts = useMemo(() => getAssignableParts(selectedWidget), [selectedWidget]);

    useEffect(() => {
        const loadImages = async () => {
            setLoading(true);
            try {
                const result = await themesApi.listLibraryImages(themeId);
                setImages(result.images || []);
            } catch (error) {
                addNotification({
                    type: 'error',
                    message: error.message || 'Failed to load image'
                });
            } finally {
                setLoading(false);
            }
        };

        if (themeId) loadImages();
    }, [themeId, addNotification]);

    useEffect(() => {
        setSettings(prev => {
            const next = { ...prev };
            let changed = false;

            if (!next.widgetType && assignableWidgetTypes.length > 0) {
                next.widgetType = assignableWidgetTypes[0].type;
                changed = true;
            }

            const widget = assignableWidgetTypes.find(item => item.type === next.widgetType);
            const parts = getAssignableParts(widget);
            if ((!next.part || !parts.some(part => part.id === next.part)) && parts.length > 0) {
                next.part = parts[0].id;
                changed = true;
            }

            return changed ? next : prev;
        });
    }, [assignableWidgetTypes]);

    const handleWidgetTypeChange = (widgetType) => {
        const firstPart = getAssignableParts(assignableWidgetTypes.find(item => item.type === widgetType))[0]?.id || '';
        setSettings(prev => ({
            ...prev,
            widgetType,
            part: firstPart,
        }));
    };

    const handleApply = () => {
        if (!image || !settings.widgetType || !settings.part || !onDesignGroupsChange) return;

        const updatedGroups = [...groups];
        const targetIndex = settings.groupIndex === '__new__'
            ? updatedGroups.length
            : Number(settings.groupIndex);
        const widgetLabel = formatWidgetName(settings.widgetType, widgetTypes);
        const existingGroup = updatedGroups[targetIndex] || {
            name: `${widgetLabel} images`,
            elements: {},
            targetingMode: 'widget-slot',
        };
        const currentWidgetTypes = existingGroup.widgetTypes || (existingGroup.widgetType ? [existingGroup.widgetType] : []);
        const nextWidgetTypes = currentWidgetTypes.includes(settings.widgetType)
            ? currentWidgetTypes
            : [...currentWidgetTypes, settings.widgetType];
        const layoutProperties = { ...(existingGroup.layoutProperties || {}) };
        const partProps = { ...(layoutProperties[settings.part] || {}) };
        const breakpointProps = { ...(partProps[settings.breakpoint] || {}) };

        const imageValue = {
            url: image.url || image.publicUrl || image.imgproxyBaseUrl,
            filename: image.filename,
            size: image.size,
            backgroundSize: settings.backgroundSize,
            backgroundPosition: settings.backgroundPosition,
            backgroundRepeat: settings.backgroundRepeat,
        };

        if (image.width && image.height) {
            imageValue.width = image.width;
            imageValue.height = image.height;
            imageValue.dpr = 2;
        }

        breakpointProps.backgroundImage = imageValue;
        partProps[settings.breakpoint] = breakpointProps;
        layoutProperties[settings.part] = partProps;

        const updatedGroup = {
            ...existingGroup,
            widgetTypes: nextWidgetTypes,
            widgetType: nextWidgetTypes.length === 1 ? nextWidgetTypes[0] : null,
            layoutProperties,
        };
        updatedGroup.calculatedSelectors = calculateSelectorsForGroup(updatedGroup);
        updatedGroups[targetIndex] = updatedGroup;

        onDesignGroupsChange({
            ...designGroups,
            groups: updatedGroups,
        });
        setSettings(prev => ({ ...prev, groupIndex: String(targetIndex) }));
        if (onDirty) onDirty();

        addNotification({
            type: 'success',
            message: `Assigned "${image.filename}" to ${widgetLabel}`
        });
    };

    const handleRemoveAssignment = (assignment) => {
        const updatedGroups = [...groups];
        const group = { ...updatedGroups[assignment.groupIndex] };
        const layoutProperties = { ...(group.layoutProperties || {}) };
        const partProps = { ...(layoutProperties[assignment.part] || {}) };
        const breakpointProps = { ...(partProps[assignment.breakpoint] || {}) };

        if (assignment.legacyImagesMap) {
            const imagesMap = { ...(breakpointProps.images || {}) };
            delete imagesMap[assignment.property];
            if (Object.keys(imagesMap).length > 0) {
                breakpointProps.images = imagesMap;
            } else {
                delete breakpointProps.images;
            }
        } else {
            delete breakpointProps[assignment.property];
        }

        if (Object.keys(breakpointProps).length > 0) {
            partProps[assignment.breakpoint] = breakpointProps;
        } else {
            delete partProps[assignment.breakpoint];
        }

        if (Object.keys(partProps).length > 0) {
            layoutProperties[assignment.part] = partProps;
        } else {
            delete layoutProperties[assignment.part];
        }

        group.layoutProperties = Object.keys(layoutProperties).length > 0 ? layoutProperties : undefined;
        group.calculatedSelectors = calculateSelectorsForGroup(group);
        updatedGroups[assignment.groupIndex] = group;

        onDesignGroupsChange({
            ...designGroups,
            groups: updatedGroups,
        });
        if (onDirty) onDirty();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
            </div>
        );
    }

    if (!image) {
        return (
            <div className="p-6">
                <button
                    type="button"
                    onClick={() => navigate(`/settings/themes/${themeId}/images`)}
                    className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
                >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back to images
                </button>
                <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-lg">
                    <ImageIcon className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <div className="text-sm font-medium text-gray-900">Image not found</div>
                    <div className="text-sm text-gray-600 mt-1">{decodedFilename}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <button
                type="button"
                onClick={() => navigate(`/settings/themes/${themeId}/images`)}
                className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to images
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6">
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-100 flex items-center justify-center max-h-[520px]">
                        <OptimizedImage
                            src={image.imgproxyBaseUrl || image.publicUrl || image.url}
                            alt={image.filename}
                            width={image.width}
                            height={image.height}
                            actualWidth={image.width}
                            actualHeight={image.height}
                            className="w-full h-auto max-h-[520px] object-contain"
                            resizeType="fit"
                            quality={85}
                        />
                    </div>
                    <div className="p-4 border-t border-gray-200">
                        <div className="text-lg font-semibold text-gray-900">{image.filename}</div>
                        <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-600">
                            {image.width && image.height && <span>{image.width} x {image.height}px</span>}
                            <span>{(image.size / 1024).toFixed(1)} KB</span>
                            {image.uploadedAt && <span>{new Date(image.uploadedAt).toLocaleDateString()}</span>}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="text-sm font-semibold text-gray-900 mb-3">Current Usage</div>
                        {assignments.length === 0 ? (
                            <div className="text-sm text-gray-600 py-4 text-center bg-gray-50 rounded-md">
                                Not assigned to any widget yet.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {assignments.map((assignment, index) => (
                                    <div key={`${assignment.groupIndex}-${assignment.part}-${assignment.breakpoint}-${index}`} className="border border-gray-200 rounded-md p-3">
                                        <div className="text-sm font-medium text-gray-900">{assignment.groupName}</div>
                                        <div className="text-xs text-gray-600 mt-1">
                                            {formatWidgetName(assignment.widgetTypes[0], widgetTypes)} / {formatPartName(assignment.part, assignment.widgetTypes[0], widgetTypes)} / {assignment.breakpoint}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveAssignment(assignment)}
                                            className="mt-3 inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                            Remove usage
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="text-sm font-semibold text-gray-900 mb-3">Assign Usage</div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Design Group</label>
                                <select
                                    value={settings.groupIndex}
                                    onChange={(e) => setSettings(prev => ({ ...prev, groupIndex: e.target.value }))}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                >
                                    <option value="__new__">Create new group</option>
                                    {groups.map((group, index) => (
                                        <option key={`${group.name}-${index}`} value={index}>{group.name || `Group ${index + 1}`}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Widget</label>
                                <select
                                    value={settings.widgetType}
                                    onChange={(e) => handleWidgetTypeChange(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                >
                                    {assignableWidgetTypes.map(widget => (
                                        <option key={widget.type} value={widget.type}>{widget.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Part</label>
                                    <select
                                        value={settings.part}
                                        onChange={(e) => setSettings(prev => ({ ...prev, part: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    >
                                        {availableParts.map(part => (
                                            <option key={part.id} value={part.id}>{part.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Breakpoint</label>
                                    <select
                                        value={settings.breakpoint}
                                        onChange={(e) => setSettings(prev => ({ ...prev, breakpoint: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    >
                                        {BREAKPOINT_OPTIONS.map(bp => (
                                            <option key={bp} value={bp}>{bp}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <select
                                    value={settings.backgroundSize}
                                    onChange={(e) => setSettings(prev => ({ ...prev, backgroundSize: e.target.value }))}
                                    className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                >
                                    <option value="cover">Cover</option>
                                    <option value="contain">Contain</option>
                                    <option value="auto">Auto</option>
                                    <option value="100% 100%">Stretch</option>
                                </select>
                                <select
                                    value={settings.backgroundPosition}
                                    onChange={(e) => setSettings(prev => ({ ...prev, backgroundPosition: e.target.value }))}
                                    className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                >
                                    <option value="center">Center</option>
                                    <option value="top left">Top Left</option>
                                    <option value="top center">Top Center</option>
                                    <option value="top right">Top Right</option>
                                    <option value="bottom left">Bottom Left</option>
                                    <option value="bottom center">Bottom Center</option>
                                    <option value="bottom right">Bottom Right</option>
                                </select>
                                <select
                                    value={settings.backgroundRepeat}
                                    onChange={(e) => setSettings(prev => ({ ...prev, backgroundRepeat: e.target.value }))}
                                    className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                >
                                    <option value="no-repeat">No Repeat</option>
                                    <option value="repeat">Repeat</option>
                                    <option value="repeat-x">Repeat X</option>
                                    <option value="repeat-y">Repeat Y</option>
                                </select>
                            </div>

                            <button
                                type="button"
                                onClick={handleApply}
                                disabled={!settings.widgetType || !settings.part}
                                className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Link2 className="h-4 w-4" />
                                Assign to widget
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ThemeImageEditView;
