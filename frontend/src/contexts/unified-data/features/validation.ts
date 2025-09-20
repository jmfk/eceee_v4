import { PageData, WidgetData, LayoutData, VersionData, AppState } from '../types/state';
import { Operation } from '../types/operations';

/**
 * Validation helpers for UnifiedDataContext
 * Provides schema validation, business rule validation, and data integrity checks
 */

export interface ValidationRule<T = any> {
    name: string;
    validate: (data: T, context?: AppState) => ValidationResult;
    severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

export interface ValidationError {
    field: string;
    message: string;
    code: string;
    value?: any;
}

export interface ValidationWarning {
    field: string;
    message: string;
    code: string;
    value?: any;
}

/**
 * Page validation rules
 */
export const pageValidationRules: ValidationRule<PageData>[] = [
    {
        name: 'required-title',
        severity: 'error',
        validate: (page) => ({
            isValid: Boolean(page.title?.trim()),
            errors: page.title?.trim() ? [] : [{
                field: 'title',
                message: 'Page title is required',
                code: 'REQUIRED_FIELD',
                value: page.title
            }],
            warnings: []
        })
    },
    {
        name: 'required-slug',
        severity: 'error',
        validate: (page) => ({
            isValid: Boolean(page.slug?.trim()),
            errors: page.slug?.trim() ? [] : [{
                field: 'slug',
                message: 'Page slug is required',
                code: 'REQUIRED_FIELD',
                value: page.slug
            }],
            warnings: []
        })
    },
    {
        name: 'slug-format',
        severity: 'error',
        validate: (page) => {
            const slugPattern = /^[a-z0-9-]+$/;
            const isValid = !page.slug || slugPattern.test(page.slug);
            
            return {
                isValid,
                errors: isValid ? [] : [{
                    field: 'slug',
                    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
                    code: 'INVALID_FORMAT',
                    value: page.slug
                }],
                warnings: []
            };
        }
    },
    {
        name: 'unique-slug',
        severity: 'error',
        validate: (page, context) => {
            if (!context || !page.slug) {
                return { isValid: true, errors: [], warnings: [] };
            }

            const duplicateSlug = Object.values(context.pages).some(
                p => p.id !== page.id && p.slug === page.slug
            );

            return {
                isValid: !duplicateSlug,
                errors: duplicateSlug ? [{
                    field: 'slug',
                    message: 'Page slug must be unique',
                    code: 'DUPLICATE_VALUE',
                    value: page.slug
                }] : [],
                warnings: []
            };
        }
    }
];

/**
 * Widget validation rules
 */
export const widgetValidationRules: ValidationRule<WidgetData>[] = [
    {
        name: 'required-type',
        severity: 'error',
        validate: (widget) => ({
            isValid: Boolean(widget.type),
            errors: widget.type ? [] : [{
                field: 'type',
                message: 'Widget type is required',
                code: 'REQUIRED_FIELD',
                value: widget.type
            }],
            warnings: []
        })
    },
    {
        name: 'required-slot',
        severity: 'error',
        validate: (widget) => ({
            isValid: Boolean(widget.slot),
            errors: widget.slot ? [] : [{
                field: 'slot',
                message: 'Widget slot is required',
                code: 'REQUIRED_FIELD',
                value: widget.slot
            }],
            warnings: []
        })
    },
    {
        name: 'valid-config',
        severity: 'warning',
        validate: (widget) => {
            const hasConfig = Boolean(widget.config && Object.keys(widget.config).length > 0);
            
            return {
                isValid: true, // Config can be empty
                errors: [],
                warnings: hasConfig ? [] : [{
                    field: 'config',
                    message: 'Widget has no configuration',
                    code: 'EMPTY_CONFIG',
                    value: widget.config
                }]
            };
        }
    }
];

/**
 * Layout validation rules
 */
export const layoutValidationRules: ValidationRule<LayoutData>[] = [
    {
        name: 'required-name',
        severity: 'error',
        validate: (layout) => ({
            isValid: Boolean(layout.name?.trim()),
            errors: layout.name?.trim() ? [] : [{
                field: 'name',
                message: 'Layout name is required',
                code: 'REQUIRED_FIELD',
                value: layout.name
            }],
            warnings: []
        })
    },
    {
        name: 'required-slots',
        severity: 'error',
        validate: (layout) => ({
            isValid: layout.slots && layout.slots.length > 0,
            errors: layout.slots?.length > 0 ? [] : [{
                field: 'slots',
                message: 'Layout must have at least one slot',
                code: 'REQUIRED_FIELD',
                value: layout.slots
            }],
            warnings: []
        })
    },
    {
        name: 'unique-slot-ids',
        severity: 'error',
        validate: (layout) => {
            if (!layout.slots) {
                return { isValid: true, errors: [], warnings: [] };
            }

            const slotIds = layout.slots.map(s => s.id);
            const uniqueIds = new Set(slotIds);
            const isValid = slotIds.length === uniqueIds.size;

            return {
                isValid,
                errors: isValid ? [] : [{
                    field: 'slots',
                    message: 'Slot IDs must be unique within layout',
                    code: 'DUPLICATE_VALUE',
                    value: slotIds
                }],
                warnings: []
            };
        }
    }
];

/**
 * Validate a single entity
 */
export function validateEntity<T>(
    entity: T,
    rules: ValidationRule<T>[],
    context?: AppState
): ValidationResult {
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];

    for (const rule of rules) {
        try {
            const result = rule.validate(entity, context);
            allErrors.push(...result.errors);
            allWarnings.push(...result.warnings);
        } catch (error) {
            allErrors.push({
                field: 'validation',
                message: `Validation rule '${rule.name}' failed: ${error.message}`,
                code: 'VALIDATION_ERROR'
            });
        }
    }

    return {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings
    };
}

/**
 * Validate operation before execution
 */
export function validateOperation(operation: Operation, context?: AppState): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic operation validation
    if (!operation.type) {
        errors.push({
            field: 'type',
            message: 'Operation type is required',
            code: 'REQUIRED_FIELD'
        });
    }

    if (!operation.payload) {
        errors.push({
            field: 'payload',
            message: 'Operation payload is required',
            code: 'REQUIRED_FIELD'
        });
    }

    // Entity-specific validation
    switch (operation.type) {
        case OperationTypes.CREATE_PAGE:
        case OperationTypes.UPDATE_PAGE:
            if (operation.payload.pageData || operation.payload.updates) {
                const pageData = operation.payload.pageData || operation.payload.updates;
                const pageValidation = validateEntity(pageData, pageValidationRules, context);
                errors.push(...pageValidation.errors);
                warnings.push(...pageValidation.warnings);
            }
            break;

        case OperationTypes.ADD_WIDGET:
        case OperationTypes.UPDATE_WIDGET:
            if (operation.payload.widgetData || operation.payload.config) {
                const widgetData = operation.payload.widgetData || {
                    id: operation.payload.id,
                    type: operation.payload.widgetType,
                    slot: operation.payload.slotId,
                    config: operation.payload.config
                };
                const widgetValidation = validateEntity(widgetData, widgetValidationRules, context);
                errors.push(...widgetValidation.errors);
                warnings.push(...widgetValidation.warnings);
            }
            break;

        case OperationTypes.CREATE_LAYOUT:
        case OperationTypes.UPDATE_LAYOUT:
            if (operation.payload.layoutData || operation.payload.updates) {
                const layoutData = operation.payload.layoutData || operation.payload.updates;
                const layoutValidation = validateEntity(layoutData, layoutValidationRules, context);
                errors.push(...layoutValidation.errors);
                warnings.push(...layoutValidation.warnings);
            }
            break;
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validate complete application state
 */
export function validateAppState(state: AppState): ValidationResult {
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];

    // Validate all pages
    Object.values(state.pages).forEach(page => {
        const result = validateEntity(page, pageValidationRules, state);
        allErrors.push(...result.errors.map(e => ({ ...e, field: `pages.${page.id}.${e.field}` })));
        allWarnings.push(...result.warnings.map(w => ({ ...w, field: `pages.${page.id}.${w.field}` })));
    });

    // Validate all widgets
    Object.values(state.widgets).forEach(widget => {
        const result = validateEntity(widget, widgetValidationRules, state);
        allErrors.push(...result.errors.map(e => ({ ...e, field: `widgets.${widget.id}.${e.field}` })));
        allWarnings.push(...result.warnings.map(w => ({ ...w, field: `widgets.${widget.id}.${w.field}` })));
    });

    // Validate all layouts
    Object.values(state.layouts).forEach(layout => {
        const result = validateEntity(layout, layoutValidationRules, state);
        allErrors.push(...result.errors.map(e => ({ ...e, field: `layouts.${layout.id}.${e.field}` })));
        allWarnings.push(...result.warnings.map(w => ({ ...w, field: `layouts.${layout.id}.${w.field}` })));
    });

    // Validate relationships
    Object.values(state.widgets).forEach(widget => {
        if (widget.pageId && !state.pages[widget.pageId]) {
            allErrors.push({
                field: `widgets.${widget.id}.pageId`,
                message: `Widget references non-existent page: ${widget.pageId}`,
                code: 'INVALID_REFERENCE',
                value: widget.pageId
            });
        }
    });

    return {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings
    };
}

/**
 * Create custom validation rule
 */
export function createValidationRule<T>(
    name: string,
    validator: (data: T, context?: AppState) => boolean | ValidationResult,
    severity: 'error' | 'warning' | 'info' = 'error',
    message?: string
): ValidationRule<T> {
    return {
        name,
        severity,
        validate: (data, context) => {
            try {
                const result = validator(data, context);
                
                if (typeof result === 'boolean') {
                    return {
                        isValid: result,
                        errors: result ? [] : [{
                            field: 'unknown',
                            message: message || `Validation failed for rule: ${name}`,
                            code: name.toUpperCase().replace(/[^A-Z0-9]/g, '_')
                        }],
                        warnings: []
                    };
                }
                
                return result;
            } catch (error) {
                return {
                    isValid: false,
                    errors: [{
                        field: 'validation',
                        message: `Validation rule '${name}' threw error: ${error.message}`,
                        code: 'VALIDATION_ERROR'
                    }],
                    warnings: []
                };
            }
        }
    };
}
