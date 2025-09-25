import React, { useState, useEffect, useId } from 'react';
import { Button } from '../ui/Button';
import { IconCode } from '../icons/IconCode';
import { HtmlEditor } from './HtmlEditor';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';
import { OperationTypes } from '../../contexts/unified-data/types/operations';
import { getWidgetContent, hasWidgetContentChanged } from '../../utils/widgetUtils';
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
    const { useExternalChanges, publishUpdate } = useUnifiedData();
    const slotName: string = context?.slotName ?? 'main';
    const widgetId: string = String(context?.widgetId ?? '');
    const fieldId = `field-${widgetId}`;

    const contextType = useEditorContext();

    useExternalChanges(fieldId, state => {
        const { content: newContent } = getWidgetContent(state, widgetId, slotName);
        if (hasWidgetContentChanged(currentValue, newContent)) {
            setCurrentValue(newContent);
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
        publishUpdate(fieldId, OperationTypes.UPDATE_WIDGET_CONFIG, {
            id: widgetId,
            slotName: slotName,
            contextType,
            config: {
                content: newValue
            }
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