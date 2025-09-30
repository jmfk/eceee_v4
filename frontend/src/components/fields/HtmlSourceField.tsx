import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { IconCode } from '../icons/IconCode';
import { HtmlEditor } from './HtmlEditor';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';
import { OperationTypes } from '../../contexts/unified-data/types/operations';
import { lookupWidget, hasWidgetContentChanged } from '../../utils/widgetUtils';
import { useEditorContext } from '../../contexts/unified-data/hooks'
import type EditorContext from '../../contexts/unified-data/types/editorContext'


// Use shared EditorContext type

interface HtmlSourceFieldProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    error?: string;
    required?: boolean;
    context: EditorContext;
}

const HtmlSourceField: React.FC<HtmlSourceFieldProps> = ({
    value,
    onChange,
    label,
    error,
    required,
    context,
}) => {
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);
    const { useExternalChanges, publishUpdate, getState } = useUnifiedData();
    const slotName: string = context?.slotName ?? 'main';
    const widgetId: string = String(context?.widgetId ?? '');
    const fieldId = `field-${widgetId}`;

    const contextType = useEditorContext();

    // Run initialization only once on mount
    useEffect(() => {
        if (!widgetId || !slotName) {
            return;
        }
        const currentState = getState();
        const widgetPath = (context as any)?.widgetPath;
        const widget = lookupWidget(currentState, widgetId, slotName, contextType, widgetPath);
        const udcConfig = widget?.config;
        if (udcConfig?.content !== undefined && udcConfig.content !== value) {
            setCurrentValue(udcConfig.content);
        }
    }, []);

    useExternalChanges(fieldId, state => {
        const widgetPath = (context as any)?.widgetPath;
        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath);
        const newConfig = widget?.config;
        if (newConfig && hasWidgetContentChanged(currentValue, newConfig?.content)) {
            setCurrentValue(newConfig.content);
        }
    });

    const handleOpenEditor = () => {
        setIsEditorOpen(true);
    };

    const handleCloseEditor = () => {
        setIsEditorOpen(false);
    };

    const handleEditorFocus = () => {
        // Focus handling is now managed by the update lock
    };

    const handleEditorBlur = () => {
        // Blur handling is now managed by the update lock
    };

    const handleChange = (newValue: string) => {
        setCurrentValue(newValue);

        // Get current widget state to merge with new content
        const currentState = getState();
        const widgetPath = (context as any)?.widgetPath;
        const widget = lookupWidget(currentState, widgetId, slotName, contextType, widgetPath);

        // Merge new content with existing config
        const updatedConfig = {
            ...(widget?.config || {}),
            content: newValue
        };

        publishUpdate(fieldId, OperationTypes.UPDATE_WIDGET_CONFIG, {
            id: widgetId,
            slotName: slotName,
            contextType,
            config: updatedConfig,
            // NEW: Path-based approach (supports infinite nesting)
            widgetPath: widgetPath && widgetPath.length > 0 ? widgetPath : undefined
        });
        onChange(newValue);
    };

    return (
        <div className="field-container">
            <label htmlFor={fieldId} className="field-label">
                {label}
                {required && <span className="required-mark">*</span>}
            </label>

            <div className="field-content">
                <Button
                    onClick={handleOpenEditor}
                    variant="secondary"
                    className="html-editor-trigger flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    <IconCode size={16} />
                    Open HTML Editor
                </Button>

                {error && <div className="field-error">{error}</div>}
            </div>

            {isEditorOpen && (
                <HtmlEditor
                    value={currentValue}
                    onChange={handleChange}
                    onClose={handleCloseEditor}
                    onFocus={handleEditorFocus}
                    onBlur={handleEditorBlur}
                />
            )}
        </div>
    );
};

HtmlSourceField.displayName = 'HtmlSourceField';

export default HtmlSourceField;