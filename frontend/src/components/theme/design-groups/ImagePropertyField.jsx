/**
 * ImagePropertyField Component
 * 
 * Reusable field for image properties in layoutProperties.
 * Uses DirectImageUpload for direct object storage uploads.
 */

import React from 'react';
import DirectImageUpload from './DirectImageUpload';

const ImagePropertyField = ({
    themeId,
    value,
    onChange,
    label,
    breakpoint,
    part,
    disabled = false,
}) => {
    return (
        <DirectImageUpload
            themeId={themeId}
            value={value}
            onChange={onChange}
            label={label}
            disabled={disabled}
        />
    );
};

ImagePropertyField.displayName = 'ImagePropertyField';

export default ImagePropertyField;

