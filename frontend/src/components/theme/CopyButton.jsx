/**
 * Reusable Copy Button Component
 * 
 * Displays a copy icon button that copies data to clipboard
 * Shows visual feedback on success/failure
 */

import React, { useState } from 'react';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { copyToClipboard } from '../../utils/themeCopyPaste';

const CopyButton = ({
    data,
    level,
    section = null,
    itemKey = null,
    className = '',
    size = 'default',
    onSuccess = null,
    onError = null,
    label = null,
    iconOnly = false
}) => {
    const [status, setStatus] = useState('idle'); // 'idle', 'success', 'error'

    const handleCopy = async (e) => {
        e.stopPropagation();

        const result = await copyToClipboard(data, level, section, itemKey);

        if (result.success) {
            setStatus('success');
            if (onSuccess) onSuccess();
            setTimeout(() => setStatus('idle'), 2000);
        } else {
            setStatus('error');
            if (onError) onError(result.error);
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    const sizeClasses = {
        small: 'w-3 h-3',
        default: 'w-4 h-4',
        large: 'w-5 h-5',
    };

    const iconSize = sizeClasses[size] || sizeClasses.default;

    const getIcon = () => {
        if (status === 'success') return <Check className={iconSize} />;
        if (status === 'error') return <AlertCircle className={iconSize} />;
        return <Copy className={iconSize} />;
    };

    const getColor = () => {
        if (status === 'success') return 'text-green-600 hover:text-green-700';
        if (status === 'error') return 'text-red-600 hover:text-red-700';
        return 'text-gray-600 hover:text-gray-900';
    };

    const getTitle = () => {
        if (status === 'success') return 'Copied!';
        if (status === 'error') return 'Failed to copy';
        return 'Copy to clipboard';
    };

    if (iconOnly) {
        return (
            <button
                type="button"
                onClick={handleCopy}
                className={`${getColor()} transition-colors ${className}`}
                title={getTitle()}
            >
                {getIcon()}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-sm font-medium rounded-md ${getColor()} bg-white hover:bg-gray-50 transition-colors ${className}`}
            title={getTitle()}
        >
            {getIcon()}
            {label || 'Copy'}
        </button>
    );
};

export default CopyButton;

