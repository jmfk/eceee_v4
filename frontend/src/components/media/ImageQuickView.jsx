/**
 * ImageQuickView Component
 * 
 * Simple full-screen image preview - click anywhere to close
 */

import React, { useEffect } from 'react';
import OptimizedImage from './OptimizedImage';

const ImageQuickView = ({ image, onClose }) => {
    // Handle ESC key to close
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    if (!image) return null;

    const originalUrl = image.imgproxyBaseUrl || image.fileUrl;

    return (
        <div 
            className="fixed inset-0 z-[10010] flex items-center justify-center p-4 cursor-pointer"
            onClick={onClose}
        >
            <img
                src={originalUrl}
                alt={image.title || image.original_filename || 'Image'}
                className="max-w-full max-h-full object-contain"
            />
        </div>
    );
};

export default ImageQuickView;

