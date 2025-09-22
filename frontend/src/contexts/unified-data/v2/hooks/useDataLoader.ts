import { useCallback } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { Operation } from '../types/operations';

export function useDataLoader() {
    const { dispatch } = useUnifiedData();

    const loadPageDataToContext = useCallback(async (pageId: string, data: any) => {
        await dispatch({
            type: 'LOAD_PAGE_DATA_TO_CONTEXT',
            payload: { pageId, data }
        } as Operation);
    }, [dispatch]);

    const validateWidgets = useCallback(async (pageId: string, widgets: any[]) => {
        await dispatch({
            type: 'VALIDATE_WIDGETS',
            payload: { pageId, widgets }
        } as Operation);
    }, [dispatch]);

    const validateLayout = useCallback(async (pageId: string, layout: any) => {
        await dispatch({
            type: 'VALIDATE_LAYOUT',
            payload: { pageId, layout }
        } as Operation);
    }, [dispatch]);

    return {
        loadPageDataToContext,
        validateWidgets,
        validateLayout
    };
}