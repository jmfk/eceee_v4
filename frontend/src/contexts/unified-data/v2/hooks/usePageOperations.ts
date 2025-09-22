import { useCallback } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { Operation } from '../types/operations';

export function usePageOperations() {
    const { dispatch, get, subscribe } = useUnifiedData();

    const loadPageData = useCallback(async (pageId: string) => {
        await dispatch({
            type: 'LOAD_PAGE_DATA',
            payload: { pageId }
        } as Operation);
    }, [dispatch]);

    const updatePageState = useCallback(async (pageId: string, data: any) => {
        await dispatch({
            type: 'UPDATE_PAGE_STATE',
            payload: { pageId, data }
        } as Operation);
    }, [dispatch]);

    const getPageState = useCallback((pageId: string) => {
        return get(`pages.${pageId}`);
    }, [get]);

    const subscribeToPage = useCallback((pageId: string, callback: (data: any) => void) => {
        return subscribe(`pages.${pageId}`, callback);
    }, [subscribe]);

    return {
        loadPageData,
        updatePageState,
        getPageState,
        subscribeToPage
    };
}
