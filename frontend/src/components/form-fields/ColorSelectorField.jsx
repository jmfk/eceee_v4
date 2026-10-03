/**
 * ColorSelectorField - Wrapper for ColorSelector to work in form system
 * 
 * Adapts ColorSelector (theme palette color picker) to work as a form field component.
 * Extracts theme palette from context and passes to ColorSelector.
 */

import React, { useMemo } from 'react';
import ColorSelector from '../theme/form-fields/ColorSelector';
import FieldHelpText from './FieldHelpText';

const ColorSelectorField = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    context,
    fieldName, // Extract to prevent spreading to DOM
    ...props
}) => {
    // Extract theme palette/colors from context
    // Support both 'palette' (old) and 'colors' (current backend field)
    const themePalette = useMemo(() => {
        return context?.theme?.palette || context?.theme?.colors || {};
    }, [context?.theme?.palette, context?.theme?.colors]);

    const hasError = validation && !validation.isValid;

    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            <FieldHelpText>{description}</FieldHelpText>
            <ColorSelector
                value={value || ''}
                onChange={onChange}
                colors={themePalette}
                label={null}
                className=""
            />

            {/* Validation Message */}
            {hasError && validation?.errors?.length > 0 && (
                <div className="text-sm text-red-600">
                    {validation.errors[0]}
                </div>
            )}

            {/* Loading State */}
            {isValidating && (
                <div className="text-sm text-blue-600">
                    Validating...
                </div>
            )}
        </div>
    );
};

ColorSelectorField.displayName = 'ColorSelectorField';

export default ColorSelectorField;
