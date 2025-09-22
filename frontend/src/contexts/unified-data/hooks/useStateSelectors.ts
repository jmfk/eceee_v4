import React, { useState } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';

export function useIsDirty() {
    const [isDirty, setIsDirty] = useState(false);
    const { useExternalChanges } = useUnifiedData();
    useExternalChanges('isDirty-hook', state => {
        setIsDirty(state.metadata.isDirty);
    });
    return isDirty;
}

export function useIsLoading() {
    const [isLoading, setIsLoading] = useState(false);
    const { useExternalChanges } = useUnifiedData();
    useExternalChanges('isLoading-hook', state => {
        setIsLoading(state.metadata.isLoading);
    });
    return isLoading;
}
