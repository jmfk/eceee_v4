import { UnifiedState, Action } from '../types/state';

/**
 * Reducer for managing unified state
 */
export function stateReducer(state: UnifiedState, action: Action): UnifiedState {
    switch (action.type) {
        // Object actions
        case 'UPDATE_OBJECT_DATA': {
            const { objectId, data } = action.payload;
            return {
                ...state,
                objects: {
                    ...state.objects,
                    [objectId]: {
                        ...state.objects[objectId],
                        data: {
                            ...state.objects[objectId].data,
                            ...data
                        },
                        isDirty: true,
                        hasUnsavedChanges: true
                    }
                },
                isDirty: true,
                hasUnsavedChanges: true
            };
        }

        case 'UPDATE_OBJECT_TITLE': {
            const { objectId, title } = action.payload;
            return {
                ...state,
                objects: {
                    ...state.objects,
                    [objectId]: {
                        ...state.objects[objectId],
                        title,
                        isDirty: true,
                        hasUnsavedChanges: true
                    }
                },
                isDirty: true,
                hasUnsavedChanges: true
            };
        }

        case 'UPDATE_OBJECT_METADATA': {
            const { objectId, metadata } = action.payload;
            return {
                ...state,
                objects: {
                    ...state.objects,
                    [objectId]: {
                        ...state.objects[objectId],
                        metadata: {
                            ...state.objects[objectId].metadata,
                            ...metadata
                        },
                        isDirty: true,
                        hasUnsavedChanges: true
                    }
                },
                isDirty: true,
                hasUnsavedChanges: true
            };
        }

        case 'UPDATE_OBJECT_STATUS': {
            const { objectId, status } = action.payload;
            return {
                ...state,
                objects: {
                    ...state.objects,
                    [objectId]: {
                        ...state.objects[objectId],
                        status,
                        isDirty: true,
                        hasUnsavedChanges: true
                    }
                },
                isDirty: true,
                hasUnsavedChanges: true
            };
        }

        case 'SAVE_OBJECT': {
            const { objectId } = action.payload;
            return {
                ...state,
                objects: {
                    ...state.objects,
                    [objectId]: {
                        ...state.objects[objectId],
                        isDirty: false,
                        hasUnsavedChanges: false
                    }
                }
            };
        }

        case 'RESET_OBJECT': {
            const { objectId } = action.payload;
            return {
                ...state,
                objects: {
                    ...state.objects,
                    [objectId]: {
                        ...state.objects[objectId],
                        isDirty: false,
                        hasUnsavedChanges: false,
                        errors: [],
                        warnings: []
                    }
                }
            };
        }

        // Widget actions
        case 'ADD_WIDGET': {
            const { id, type: widgetType, config, slotName, order } = action.payload;
            return {
                ...state,
                widgets: {
                    ...state.widgets,
                    [id]: {
                        id,
                        type: 'widget',
                        widgetType,
                        config,
                        slotName,
                        order,
                        isDirty: true,
                        isLoading: false,
                        hasUnsavedChanges: true,
                        errors: [],
                        warnings: []
                    }
                },
                isDirty: true,
                hasUnsavedChanges: true
            };
        }

        case 'REMOVE_WIDGET': {
            const { id } = action.payload;
            const { [id]: _, ...widgets } = state.widgets;
            return {
                ...state,
                widgets,
                isDirty: true,
                hasUnsavedChanges: true
            };
        }

        case 'MOVE_WIDGET': {
            const { id, slot: slotName, order } = action.payload;
            return {
                ...state,
                widgets: {
                    ...state.widgets,
                    [id]: {
                        ...state.widgets[id],
                        slotName,
                        order,
                        isDirty: true,
                        hasUnsavedChanges: true
                    }
                },
                isDirty: true,
                hasUnsavedChanges: true
            };
        }

        case 'UPDATE_WIDGET_CONFIG': {
            const { id, config } = action.payload;
            return {
                ...state,
                widgets: {
                    ...state.widgets,
                    [id]: {
                        ...state.widgets[id],
                        config: {
                            ...state.widgets[id].config,
                            ...config
                        },
                        isDirty: true,
                        hasUnsavedChanges: true
                    }
                },
                isDirty: true,
                hasUnsavedChanges: true
            };
        }

        case 'SAVE_WIDGET': {
            const { id } = action.payload;
            return {
                ...state,
                widgets: {
                    ...state.widgets,
                    [id]: {
                        ...state.widgets[id],
                        isDirty: false,
                        hasUnsavedChanges: false
                    }
                }
            };
        }

        case 'RESET_WIDGET': {
            const { id } = action.payload;
            return {
                ...state,
                widgets: {
                    ...state.widgets,
                    [id]: {
                        ...state.widgets[id],
                        isDirty: false,
                        hasUnsavedChanges: false,
                        errors: [],
                        warnings: []
                    }
                }
            };
        }

        // Layout actions
        case 'UPDATE_LAYOUT': {
            const { name } = action.payload;
            return {
                ...state,
                layout: {
                    ...state.layout,
                    name,
                    isDirty: true,
                    hasUnsavedChanges: true
                },
                isDirty: true,
                hasUnsavedChanges: true
            };
        }

        case 'UPDATE_LAYOUT_CONFIG': {
            const { config } = action.payload;
            return {
                ...state,
                layout: {
                    ...state.layout,
                    config: {
                        ...state.layout?.config,
                        ...config
                    },
                    isDirty: true,
                    hasUnsavedChanges: true
                },
                isDirty: true,
                hasUnsavedChanges: true
            };
        }

        case 'SAVE_LAYOUT': {
            return {
                ...state,
                layout: state.layout ? {
                    ...state.layout,
                    isDirty: false,
                    hasUnsavedChanges: false
                } : null
            };
        }

        case 'RESET_LAYOUT': {
            return {
                ...state,
                layout: state.layout ? {
                    ...state.layout,
                    isDirty: false,
                    hasUnsavedChanges: false,
                    errors: [],
                    warnings: []
                } : null
            };
        }

        // Editor actions
        case 'OPEN_EDITOR': {
            const { targetId, targetType, mode } = action.payload;
            return {
                ...state,
                editor: {
                    id: `editor-${Date.now()}`,
                    type: 'editor',
                    targetId,
                    targetType,
                    mode,
                    isOpen: true,
                    isDirty: false,
                    isLoading: false,
                    hasUnsavedChanges: false,
                    errors: [],
                    warnings: []
                }
            };
        }

        case 'CLOSE_EDITOR': {
            return {
                ...state,
                editor: null
            };
        }

        case 'SAVE_EDITOR': {
            return {
                ...state,
                editor: state.editor ? {
                    ...state.editor,
                    isDirty: false,
                    hasUnsavedChanges: false
                } : null
            };
        }

        case 'RESET_EDITOR': {
            return {
                ...state,
                editor: state.editor ? {
                    ...state.editor,
                    isDirty: false,
                    hasUnsavedChanges: false,
                    errors: [],
                    warnings: []
                } : null
            };
        }

        // Form actions
        case 'UPDATE_FORM_FIELD': {
            const { formId, fieldName, value } = action.payload;
            return {
                ...state,
                forms: {
                    ...state.forms,
                    [formId]: {
                        ...state.forms[formId],
                        fields: {
                            ...state.forms[formId].fields,
                            [fieldName]: {
                                ...state.forms[formId].fields[fieldName],
                                value,
                                isDirty: true
                            }
                        },
                        isDirty: true,
                        hasUnsavedChanges: true
                    }
                },
                isDirty: true,
                hasUnsavedChanges: true
            };
        }

        case 'VALIDATE_FORM_FIELD': {
            const { formId, fieldName, validation } = action.payload;
            return {
                ...state,
                forms: {
                    ...state.forms,
                    [formId]: {
                        ...state.forms[formId],
                        fields: {
                            ...state.forms[formId].fields,
                            [fieldName]: {
                                ...state.forms[formId].fields[fieldName],
                                validation,
                                isValidating: false
                            }
                        },
                        isValidating: false,
                        isValid: validation.isValid,
                        errors: validation.errors,
                        warnings: validation.warnings
                    }
                }
            };
        }

        case 'RESET_FORM_FIELD': {
            const { formId, fieldName } = action.payload;
            return {
                ...state,
                forms: {
                    ...state.forms,
                    [formId]: {
                        ...state.forms[formId],
                        fields: {
                            ...state.forms[formId].fields,
                            [fieldName]: {
                                ...state.forms[formId].fields[fieldName],
                                isDirty: false,
                                isTouched: false,
                                validation: {
                                    isValid: true,
                                    errors: [],
                                    warnings: []
                                }
                            }
                        }
                    }
                }
            };
        }

        case 'SUBMIT_FORM': {
            const { formId } = action.payload;
            return {
                ...state,
                forms: {
                    ...state.forms,
                    [formId]: {
                        ...state.forms[formId],
                        isDirty: false,
                        hasUnsavedChanges: false
                    }
                }
            };
        }

        case 'RESET_FORM': {
            const { formId } = action.payload;
            return {
                ...state,
                forms: {
                    ...state.forms,
                    [formId]: {
                        ...state.forms[formId],
                        isDirty: false,
                        hasUnsavedChanges: false,
                        errors: [],
                        warnings: []
                    }
                }
            };
        }

        default:
            return state;
    }
}
