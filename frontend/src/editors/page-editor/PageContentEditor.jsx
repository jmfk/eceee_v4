/**
 * PageContentEditor - PageEditor-specific content editor
 * 
 * This uses the new PageEditorCore that renders shared React widgets directly
 * instead of using the old Django template-based ContentEditor.
 */

import React, { forwardRef } from 'react';
import PageEditorCore from './PageEditorCore';

const PageContentEditor = forwardRef((props, ref) => {
    // Simply delegate to PageEditorCore with all props
    return <PageEditorCore ref={ref} {...props} />;
});

PageContentEditor.displayName = 'PageContentEditor';

export default PageContentEditor;