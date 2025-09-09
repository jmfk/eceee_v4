/**
 * PageContentEditor - Simple React layout rendering
 * 
 * This uses manual React layout components instead of complex backend/frontend
 * layout protocol. Simple, flexible, and maintainable.
 */

import React, { forwardRef } from 'react';
import ReactLayoutRenderer from './ReactLayoutRenderer';

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
    // Extract layout name from layoutJson or use default
    const layoutName = layoutJson?.layout?.name ||
        layoutJson?.name ||
        pageVersionData?.codeLayout ||
        'single_column';

    // Get current widgets from pageVersionData
    const currentWidgets = pageVersionData?.widgets || {};

    // Handle widget changes
    const handleWidgetChange = (updatedWidgets) => {
        if (onUpdate) {
            onUpdate({ widgets: updatedWidgets });
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
            {...otherProps}
        />
    );
});

PageContentEditor.displayName = 'PageContentEditor';

export default PageContentEditor;