/**
 * PageContentEditor - Simple React layout rendering
 * 
 * This uses manual React layout components instead of complex backend/frontend
 * layout protocol. Simple, flexible, and maintainable.
 */

import React, { forwardRef, useMemo, useCallback } from 'react';
import ReactLayoutRenderer from './ReactLayoutRenderer';
import { useUnifiedData, useDataLoader, useWidgetSync } from '../../contexts/unified-data';

const PageContentEditor = forwardRef(({
    layoutJson,
    webpageData,
    pageVersionData,
    onUpdate,
    onDirtyChange,
    onOpenWidgetEditor,
    editable = true,
    // PageEditor-specific props
    currentVersion,
    availableVersions,
    onVersionChange,
    ...otherProps
}, ref) => {
    // Use UnifiedDataContext as primary data source with sync capabilities
    const { state } = useUnifiedData();
    const { getWidgetsAsSlots } = useDataLoader();
    const widgetSync = useWidgetSync(webpageData?.id?.toString() || '');

    // Extract layout name from multiple sources
    const layoutName = layoutJson?.layout?.name ||
        layoutJson?.name ||
        pageVersionData?.codeLayout ||
        'single_column';

    // Get current widgets - prefer UnifiedDataContext, fallback to pageVersionData
    const currentWidgets = useMemo(() => {
        if (widgetSync.isContextPrimary) {
            // Use UnifiedDataContext as primary source
            return widgetSync.syncWidgetsFromContext();
        } else {
            // Use pageVersionData as primary source
            return pageVersionData?.widgets || {};
        }
    }, [widgetSync, pageVersionData?.widgets]);

    // Handle widget changes - sync to both systems
    const handleWidgetChange = useCallback(async (updatedWidgets) => {

        // Always update PageEditor's local state (for saving)
        if (onUpdate) {
            onUpdate({ widgets: updatedWidgets });
        }

        // Sync to UnifiedDataContext if it's the primary source
        if (widgetSync.isContextPrimary) {
            try {
                const pageId = webpageData?.id?.toString();
                if (pageId) {
                    await widgetSync.syncWidgetsToContext(updatedWidgets, pageId);
                }
            } catch (error) {
                console.error('❌ Failed to sync widgets to context:', error);
            }
        }
    }, [onUpdate, widgetSync, webpageData?.id]);

    return (
        <ReactLayoutRenderer
            ref={ref}
            layoutName={layoutName}
            widgets={currentWidgets}
            onWidgetChange={handleWidgetChange}
            editable={editable}
            onDirtyChange={onDirtyChange}
            onOpenWidgetEditor={onOpenWidgetEditor}
            // PageEditor-specific props
            currentVersion={currentVersion}
            pageVersionData={pageVersionData}
            onVersionChange={onVersionChange}
            {...otherProps}
        />
    );
});

PageContentEditor.displayName = 'PageContentEditor';

export default PageContentEditor;