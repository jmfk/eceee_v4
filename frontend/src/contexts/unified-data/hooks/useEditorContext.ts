import { useUnifiedData } from '../context/UnifiedDataContext';

export type EditorContextType = 'page' | 'object' | 'other';

export function useEditorContext(): EditorContextType {
    const { getState } = useUnifiedData();
    const metadata = (getState() as any)?.metadata || {};

    const isPageContext = Boolean(metadata.currentPageId);
    if (isPageContext) {
        return 'page';
    }

    const isObjectContext = Boolean(metadata.currentObjectId);
    if (isObjectContext) {
        return 'object';
    }

    return 'other';
}


