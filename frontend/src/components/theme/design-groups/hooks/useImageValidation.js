/**
 * useImageValidation Hook
 * 
 * Validates theme design group images against breakpoint requirements.
 * Fetches validation warnings from the backend API.
 */

import { useState, useEffect, useRef } from 'react';
import { themesApi } from '../../../../api/themes';

export const useImageValidation = (themeId, designGroups, breakpoints) => {
    const [warnings, setWarnings] = useState({});
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState(null);
    const debounceTimerRef = useRef(null);

    useEffect(() => {
        // Clear any pending validation
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Skip if no theme ID
        if (!themeId) {
            setWarnings({});
            return;
        }

        // Debounce validation to avoid excessive API calls
        debounceTimerRef.current = setTimeout(async () => {
            setIsValidating(true);
            setError(null);

            try {
                const result = await themesApi.validateImages(themeId);
                setWarnings(result.warnings || {});
            } catch (err) {
                console.error('Failed to validate images:', err);
                setError(err.message || 'Failed to validate images');
                setWarnings({});
            } finally {
                setIsValidating(false);
            }
        }, 500); // 500ms debounce

        // Cleanup
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [themeId, designGroups, breakpoints]);

    // Helper to get warnings for a specific image
    const getWarningsForImage = (groupIndex, part, breakpoint, imageKey) => {
        const key = `group-${groupIndex}-${part}-${breakpoint}-${imageKey}`;
        return warnings[key] || [];
    };

    // Helper to count total warnings
    const warningCount = Object.keys(warnings).length;

    // Helper to count by severity
    const countBySeverity = (severity) => {
        return Object.values(warnings).filter(warningList => 
            warningList.some(w => w.severity === severity)
        ).length;
    };

    return {
        warnings,
        isValidating,
        error,
        warningCount,
        getWarningsForImage,
        countBySeverity,
    };
};

