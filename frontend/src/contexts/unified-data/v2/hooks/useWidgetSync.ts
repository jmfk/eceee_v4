import { useCallback, useEffect, useRef } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { Operation } from '../types/operations';

export function useWidgetSync() {
    const { dispatch, get, subscribe } = useUnifiedData();
    const isContextPrimaryRef = useRef(false);

    const setContextPrimary = useCallback((isPrimary: boolean) => {
        isContextPrimaryRef.current = isPrimary;
    }, []);

    const isContextPrimary = useCallback(() => {
        return isContextPrimaryRef.current;
    }, []);

    const syncWidgetsFromContext = useCallback(async (pageId: string, widgets: any[]) => {
        if (!isContextPrimaryRef.current) return;

        await dispatch({
            type: 'SYNC_WIDGETS_FROM_CONTEXT',
            payload: { pageId, widgets }
        } as Operation);
    }, [dispatch]);

    const syncWidgets = useCallback(async (pageId: string, widgets: any[]) => {
        await dispatch({
            type: 'SYNC_WIDGETS',
            payload: { pageId, widgets }
        } as Operation);
    }, [dispatch]);

    const subscribeToWidgets = useCallback((pageId: string, callback: (widgets: any[]) => void) => {
        return subscribe(`pages.${pageId}.widgets`, callback);
    }, [subscribe]);

    return {
        setContextPrimary,
        isContextPrimary,
        syncWidgetsFromContext,
        syncWidgets,
        subscribeToWidgets
    };
}
