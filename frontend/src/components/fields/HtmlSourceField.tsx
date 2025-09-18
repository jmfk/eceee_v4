import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { IconCode } from '../icons/IconCode';
import { HtmlEditor } from './HtmlEditor';

// Generate a unique ID for the field
const generateFieldId = (label?: string) => {
    if (!label) return '';
    return `field-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).substr(2, 9)}`;
};

interface HtmlSourceFieldProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    error?: string;
    required?: boolean;
}

const HtmlSourceField: React.FC<HtmlSourceFieldProps> = ({
    value,
    onChange,
    label,
    error,
    required,
}) => {
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);
    const isEditorFocused = useRef(false);

    // Subscribe to content changes from ContentWidgetEditor
    useEffect(() => {
        const handleContentChange = (event: CustomEvent) => {
            if (!isEditorFocused.current) {
                setCurrentValue(event.detail);
            }
        };

        // Listen for content changes from the WYSIWYG editor
        window.addEventListener('content-changed', handleContentChange as EventListener);
        return () => {
            window.removeEventListener('content-changed', handleContentChange as EventListener);
        };
    }, []);

    // Keep currentValue in sync with prop when not focused
    useEffect(() => {
        if (!isEditorFocused.current) {
            setCurrentValue(value);
        }
    }, [value]);

    const fieldId = generateFieldId(label);

    const handleOpenEditor = () => {
        setIsEditorOpen(true);
    };

    const handleCloseEditor = () => {
        isEditorFocused.current = false;
        setIsEditorOpen(false);
    };

    const handleEditorFocus = () => {
        isEditorFocused.current = true;
    };

    const handleEditorBlur = () => {
        isEditorFocused.current = false;
    };

    const handleChange = (newValue: string) => {
        setCurrentValue(newValue);
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