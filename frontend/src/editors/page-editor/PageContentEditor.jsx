/**
 * PageContentEditor - Simple React layout rendering
 * 
 * This uses manual React layout components instead of complex backend/frontend
 * layout protocol. Simple, flexible, and maintainable.
 */

import React, { forwardRef, useState } from 'react';
import ReactLayoutRenderer from './ReactLayoutRenderer';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';

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
    context,
    ...otherProps
}, ref) => {
    // Extract layout name from layoutJson or use default
    const pageId = webpageData.id;
    const layoutName = layoutJson?.layout?.name ||
        layoutJson?.name ||
        pageVersionData?.codeLayout ||
        'single_column';

    // Get current widgets from pageVersionData
    const currentWidgets = pageVersionData?.widgets || {};

    // Get update lock and UnifiedData context
    const { useExternalChanges } = useUnifiedData();

    // Subscribe to widget changes and update source from UnifiedDataContext
    const componentId = `page-editor-${pageId}`;
    const [widgets, setWidgets] = useState({});
    //const [updateSourceId, setUpdateSourceId] = useState(null);

    useExternalChanges(componentId, state => {
        setWidgets(state.widgets);
    });

    // Handle widget changes
    const handleWidgetChange = async (updatedWidgets, data) => {
        if (onUpdate) {
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
            onDirtyChange={onDirtyChange}
            onOpenWidgetEditor={onOpenWidgetEditor}
            // PageEditor-specific props
            currentVersion={currentVersion}
            pageVersionData={pageVersionData}
            onVersionChange={onVersionChange}
            context={context}
            {...otherProps}
        />
    );
});

PageContentEditor.displayName = 'PageContentEditor';

export default PageContentEditor;