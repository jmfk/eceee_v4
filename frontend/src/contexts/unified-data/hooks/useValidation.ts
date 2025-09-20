import { useCallback, useMemo } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { 
    ValidationResult, 
    ValidationRule,
    validateEntity, 
    validateOperation, 
    validateAppState,
    pageValidationRules,
    widgetValidationRules,
    layoutValidationRules
} from '../features/validation';
import { PageData, WidgetData, LayoutData } from '../types/state';
import { Operation } from '../types/operations';

export interface UseValidationResult {
    // Entity validation
    validatePage: (page: PageData) => ValidationResult;
    validateWidget: (widget: WidgetData) => ValidationResult;
    validateLayout: (layout: LayoutData) => ValidationResult;
    validateOperation: (operation: Operation) => ValidationResult;
    
    // State validation
    validateCurrentState: () => ValidationResult;
    getStateErrors: () => ValidationResult;
    
    // Validation status
    isStateValid: boolean;
    hasErrors: boolean;
    hasWarnings: boolean;
    errorCount: number;
    warningCount: number;
    
    // Custom validation
    addValidationRule: <T>(entityType: 'page' | 'widget' | 'layout', rule: ValidationRule<T>) => void;
    removeValidationRule: (entityType: 'page' | 'widget' | 'layout', ruleName: string) => void;
    
    // Utilities
    getEntityErrors: (entityType: 'page' | 'widget' | 'layout', entityId: string) => ValidationResult;
    clearValidationErrors: () => void;
}

export function useValidation(): UseValidationResult {
    const { state, useSelector } = useUnifiedData();

    // Custom validation rules
    const customPageRules = useMemo(() => [...pageValidationRules], []);
    const customWidgetRules = useMemo(() => [...widgetValidationRules], []);
    const customLayoutRules = useMemo(() => [...layoutValidationRules], []);

    // Validate current state
    const currentStateValidation = useMemo(() => {
        return validateAppState(state);
    }, [state]);

    // Derived validation status
    const isStateValid = currentStateValidation.isValid;
    const hasErrors = currentStateValidation.errors.length > 0;
    const hasWarnings = currentStateValidation.warnings.length > 0;
    const errorCount = currentStateValidation.errors.length;
    const warningCount = currentStateValidation.warnings.length;

    // Entity validation methods
    const validatePage = useCallback((page: PageData): ValidationResult => {
        return validateEntity(page, customPageRules, state);
    }, [customPageRules, state]);

    const validateWidget = useCallback((widget: WidgetData): ValidationResult => {
        return validateEntity(widget, customWidgetRules, state);
    }, [customWidgetRules, state]);

    const validateLayout = useCallback((layout: LayoutData): ValidationResult => {
        return validateEntity(layout, customLayoutRules, state);
    }, [customLayoutRules, state]);

    const validateOperationCallback = useCallback((operation: Operation): ValidationResult => {
        return validateOperation(operation, state);
    }, [state]);

    // State validation methods
    const validateCurrentState = useCallback((): ValidationResult => {
        return validateAppState(state);
    }, [state]);

    const getStateErrors = useCallback((): ValidationResult => {
        return currentStateValidation;
    }, [currentStateValidation]);

    // Custom validation rule management
    const addValidationRule = useCallback(<T,>(
        entityType: 'page' | 'widget' | 'layout', 
        rule: ValidationRule<T>
    ) => {
        switch (entityType) {
            case 'page':
                customPageRules.push(rule as ValidationRule<PageData>);
                break;
            case 'widget':
                customWidgetRules.push(rule as ValidationRule<WidgetData>);
                break;
            case 'layout':
                customLayoutRules.push(rule as ValidationRule<LayoutData>);
                break;
        }
    }, [customPageRules, customWidgetRules, customLayoutRules]);

    const removeValidationRule = useCallback((
        entityType: 'page' | 'widget' | 'layout', 
        ruleName: string
    ) => {
        switch (entityType) {
            case 'page':
                const pageIndex = customPageRules.findIndex(r => r.name === ruleName);
                if (pageIndex > -1) customPageRules.splice(pageIndex, 1);
                break;
            case 'widget':
                const widgetIndex = customWidgetRules.findIndex(r => r.name === ruleName);
                if (widgetIndex > -1) customWidgetRules.splice(widgetIndex, 1);
                break;
            case 'layout':
                const layoutIndex = customLayoutRules.findIndex(r => r.name === ruleName);
                if (layoutIndex > -1) customLayoutRules.splice(layoutIndex, 1);
                break;
        }
    }, [customPageRules, customWidgetRules, customLayoutRules]);

    // Get errors for specific entity
    const getEntityErrors = useCallback((
        entityType: 'page' | 'widget' | 'layout', 
        entityId: string
    ): ValidationResult => {
        switch (entityType) {
            case 'page':
                const page = state.pages[entityId];
                return page ? validatePage(page) : { isValid: false, errors: [{ 
                    field: 'id', 
                    message: 'Page not found', 
                    code: 'NOT_FOUND' 
                }], warnings: [] };
            
            case 'widget':
                const widget = state.widgets[entityId];
                return widget ? validateWidget(widget) : { isValid: false, errors: [{ 
                    field: 'id', 
                    message: 'Widget not found', 
                    code: 'NOT_FOUND' 
                }], warnings: [] };
            
            case 'layout':
                const layout = state.layouts[entityId];
                return layout ? validateLayout(layout) : { isValid: false, errors: [{ 
                    field: 'id', 
                    message: 'Layout not found', 
                    code: 'NOT_FOUND' 
                }], warnings: [] };
            
            default:
                return { isValid: false, errors: [{ 
                    field: 'entityType', 
                    message: 'Invalid entity type', 
                    code: 'INVALID_TYPE' 
                }], warnings: [] };
        }
    }, [state, validatePage, validateWidget, validateLayout]);

    // Clear validation errors (placeholder - would integrate with error state)
    const clearValidationErrors = useCallback(() => {
        // This would clear validation-specific errors from the state
    }, []);

    return {
        // Entity validation
        validatePage,
        validateWidget,
        validateLayout,
        validateOperation: validateOperationCallback,
        
        // State validation
        validateCurrentState,
        getStateErrors,
        
        // Validation status
        isStateValid,
        hasErrors,
        hasWarnings,
        errorCount,
        warningCount,
        
        // Custom validation
        addValidationRule,
        removeValidationRule,
        
        // Utilities
        getEntityErrors,
        clearValidationErrors
    };
}
