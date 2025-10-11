/**
 * PageContentEditor - Simple React layout rendering
 * 
 * This uses manual React layout components instead of complex backend/frontend
 * layout protocol. Simple, flexible, and maintainable.
 */

import React, { forwardRef, useState, useEffect } from 'react';
import ReactLayoutRenderer from './ReactLayoutRenderer';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';
import { getDefaultLayout } from '../../utils/defaultLayout';

const PageContentEditor = forwardRef(({
    layoutJson,
    webpageData,
    pageVersionData,
    onUpdate,
    onOpenWidgetEditor,
    editable = true,
    // PageEditor-specific props
    currentVersion,
    availableVersions,
    onVersionChange,
    context,
    // Local widget state management (from PageEditor)
    localWidgets,
    onLocalWidgetUpdate,
    sharedComponentId,
    publishWidgetOperation,
    // Widget inheritance props
    inheritedWidgets,
    slotInheritanceRules,
    hasInheritedContent,
    refetchInheritance,
    ...otherProps
}, ref) => {
    // State for default layout fetched from backend
    const [defaultLayoutName, setDefaultLayoutName] = useState('main_layout');

    // Fetch default layout from backend on mount
    useEffect(() => {
        getDefaultLayout().then(layoutName => {
            setDefaultLayoutName(layoutName);
        });
    }, []);

    // Extract layout name from layoutJson or use default
    const pageId = webpageData?.id;
    const layoutName = layoutJson?.layout?.name ||
        layoutJson?.name ||
        pageVersionData?.codeLayout ||
        defaultLayoutName;  // Use default layout from backend

    // Use local widgets from PageEditor (fast local state)
    const currentWidgets = localWidgets || pageVersionData?.widgets || {};

    // Handle widget changes - use local update for fast UI
    const handleWidgetChange = async (updatedWidgets, data) => {
        if (onLocalWidgetUpdate) {
            // Use fast local update from PageEditor
            onLocalWidgetUpdate(updatedWidgets, data);
        } else if (onUpdate) {
            // Fallback to original update method
            onUpdate({ widgets: updatedWidgets }, data);
        }
    };

    return (
        <ReactLayoutRenderer
            ref={ref}
            layoutName={layoutName}
            widgets={currentWidgets}
            onWidgetChange={handleWidgetChange}
            editable={editable}
            onOpenWidgetEditor={onOpenWidgetEditor}
            // PageEditor-specific props
            currentVersion={currentVersion}
            webpageData={webpageData}
            pageVersionData={pageVersionData}
            onVersionChange={onVersionChange}
            context={context}
            // Local widget state management
            sharedComponentId={sharedComponentId}
            publishWidgetOperation={publishWidgetOperation}
            // Widget inheritance
            inheritedWidgets={inheritedWidgets}
            slotInheritanceRules={slotInheritanceRules}
            hasInheritedContent={hasInheritedContent}
            refetchInheritance={refetchInheritance}
            {...otherProps}
        />
    );
});

PageContentEditor.displayName = 'PageContentEditor';

export default PageContentEditor;