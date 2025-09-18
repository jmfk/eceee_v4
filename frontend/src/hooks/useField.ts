import { useMemo } from 'react';

/**
 * Hook to generate consistent field IDs and manage field-related utilities
 * @param label - The field label used to generate a unique ID
 * @returns Object containing field utilities
 */
export const useField = (label: string) => {
  const fieldId = useMemo(() => {
    if (!label) return '';
    return `field-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).substr(2, 9)}`;
  }, [label]);

  return {
    fieldId,
  };
};
