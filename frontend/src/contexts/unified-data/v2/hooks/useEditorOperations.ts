import { useCallback, useState } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { Operation } from '../types/operations';

export function useEditorOperations() {
    const { dispatch, get } = useUnifiedData();
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [currentEditingWidget, setCurrentEditingWidget] = useState(null);

    const openEditor = useCallback((widget: any) => {
        setIsEditorOpen(true);
        setCurrentEditingWidget(widget);
        dispatch({
            type: 'EDITOR_OPENED',
            payload: { widget }
        } as Operation);
    }, [dispatch]);

    const closeEditor = useCallback(() => {
        setIsEditorOpen(false);
        setCurrentEditingWidget(null);
        dispatch({
            type: 'EDITOR_CLOSED',
            payload: {}
        } as Operation);
    }, [dispatch]);

    const saveEditor = useCallback(async () => {
        if (!currentEditingWidget) return;
        
        await dispatch({
            type: 'EDITOR_SAVED',
            payload: { widget: currentEditingWidget }
        } as Operation);
    }, [dispatch, currentEditingWidget]);

    const getEditorState = useCallback(() => {
        return {
            isOpen: isEditorOpen,
            currentWidget: currentEditingWidget,
            resetToOriginal: () => {
                if (!currentEditingWidget) return;
                dispatch({
                    type: 'EDITOR_RESET',
                    payload: { widget: currentEditingWidget }
                } as Operation);
            }
        };
    }, [isEditorOpen, currentEditingWidget, dispatch]);

    const validateEditor = useCallback(async (widget: any) => {
        return dispatch({
            type: 'VALIDATE_EDITOR',
            payload: { widget }
        } as Operation);
    }, [dispatch]);

    return {
        openEditor,
        closeEditor,
        saveEditor,
        isEditorOpen,
        currentEditingWidget,
        getEditorState,
        validateEditor
    };
}
