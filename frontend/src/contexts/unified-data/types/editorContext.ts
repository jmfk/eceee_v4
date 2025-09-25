/**
 * EditorContext
 *
 * A reusable context object that is threaded from editors → widgets → fields.
 * It captures where an edit is happening and which widget/slot it pertains to.
 */
export interface EditorContext {
    pageId?: string;
    objectId?: string;
    widgetId?: string;
    slotId?: string;
    slotName?: string;
    mode: 'edit' | 'preview';
    contextType: 'page' | 'object' | 'other';
}

export default EditorContext;


