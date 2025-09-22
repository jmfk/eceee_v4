/**
 * PageContentEditor - Simple React layout rendering
 * 
 * This uses manual React layout components instead of complex backend/frontend
 * layout protocol. Simple, flexible, and maintainable.
 */

import React, { forwardRef, useMemo, useCallback } from 'react';
import ReactLayoutRenderer from './ReactLayoutRenderer';
import { useUnifiedData } from '../../contexts/unified-data/v2/context/UnifiedDataContext';
import { useDataLoader } from '../../contexts/unified-data/v2/hooks/useDataLoader';
import { useWidgetSync } from '../../contexts/unified-data/v2/hooks/useWidgetSync';
import { usePageOperations } from '../../contexts/unified-data/v2/hooks/usePageOperations';

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
    // Use v2 context hooks for state management
    const unifiedDataContext = useUnifiedData();
    const { getWidgetsAsSlots, validateWidgets } = useDataLoader();
    const { syncWidgets, isContextPrimary, syncWidgetsFromContext } = useWidgetSync();
    const { updatePageData, validatePageData } = usePageOperations(webpageData?.id?.toString() || '');

    // Extract layout name from multiple sources
    const layoutName = layoutJson?.layout?.name ||
        layoutJson?.name ||
        pageVersionData?.codeLayout ||
        'single_column';

    // Get current widgets - prefer v2 context, fallback to pageVersionData
    const currentWidgets = useMemo(() => {
        if (isContextPrimary()) {
            // Use v2 context as primary source - for now, get from unifiedDataContext
            const pageId = webpageData?.id?.toString();
            if (pageId) {
                return unifiedDataContext.get(`pages.${pageId}.widgets`) || {};
            }
        }
        // Use pageVersionData as primary source
        return pageVersionData?.widgets || {};
    }, [isContextPrimary, unifiedDataContext, webpageData?.id, pageVersionData?.widgets]);

    // Handle widget changes - sync to both systems
    const handleWidgetChange = useCallback(async (updatedWidgets) => {
        try {
            // Validate widgets before updating
            const isValid = await validateWidgets(updatedWidgets);
            if (!isValid) {
                throw new Error('Invalid widget configuration');
            }

            // Always update PageEditor's local state (for saving)
            if (onUpdate) {
                onUpdate({ widgets: updatedWidgets });
            }

            // Sync to v2 context if it's the primary source
            if (isContextPrimary()) {
                const pageId = webpageData?.id?.toString();
                if (pageId) {
                    // Use the context directly to update widgets
                    unifiedDataContext.set({
                        path: `pages.${pageId}.widgets`,
                        value: updatedWidgets
                    });
                    await updatePageData({ widgets: updatedWidgets });
                }
            }
        } catch (error) {
            console.error('❌ Failed to update widgets:', error);
            throw error;
        }
    }, [onUpdate, isContextPrimary, validateWidgets, unifiedDataContext, updatePageData, webpageData?.id]);

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