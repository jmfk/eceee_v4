import React, { useEffect, useMemo, useState, useCallback, useRef, Suspense } from 'react'
import { fieldTypeRegistry } from '../../utils/fieldTypeRegistry'
import SchemaFieldRenderer from './SchemaFieldRenderer'
import ValidatedInput from '../validation/ValidatedInput'
import MediaField from '../form-fields/MediaField'

/**
 * EnhancedSchemaDrivenForm Component
 * 
 * Enhanced version of SchemaDrivenForm that uses the new field type system.
 * Maintains compatibility with existing validation and schema structure.
 */
const EnhancedSchemaDrivenForm = ({
    pageVersionData,
    onChange,
    onValidationChange,
    onValidatedDataSync,
    namespace,
    schema: providedSchema = null,
    useNewFieldSystem = true
}) => {
    const [schema, setSchema] = useState(providedSchema)
    const [loading, setLoading] = useState(!providedSchema)
    const [error, setError] = useState('')
    const [fieldTypesLoaded, setFieldTypesLoaded] = useState(false)

    // Validation state (simplified for demo)
    const [validationResults, setValidationResults] = useState({})
    const [validatingProperties, setValidatingProperties] = useState(new Set())

    // Load field types
    useEffect(() => {
        const loadFieldTypes = async () => {
            try {
                await fieldTypeRegistry.ensureLoaded()
                setFieldTypesLoaded(true)
            } catch (error) {
                console.error('Failed to load field types:', error)
                setFieldTypesLoaded(true) // Continue with fallback
            }
        }

        loadFieldTypes()
    }, [])

    // Load schema if not provided
    useEffect(() => {
        if (!providedSchema && pageVersionData?.codeLayout) {
            // In real implementation, load from API
            setLoading(false)
        }
    }, [providedSchema, pageVersionData])

    const handlePropertyChange = useCallback((key, value) => {
        onChange?.({ [key]: value })
    }, [onChange])

    const properties = useMemo(() => {
        if (!schema) return {}

        // Handle both grouped and non-grouped schemas
        if (schema.groups) {
            const allProps = {}
            Object.values(schema.groups).forEach(group => {
                if (group.properties) {
                    Object.assign(allProps, group.properties)
                }
            })
            return allProps
        }

        return schema.properties || {}
    }, [schema])

    const renderField = (key, def, groupRequired = []) => {
        const value = pageVersionData?.pageData?.[key] ?? ''
        const type = Array.isArray(def.type) ? def.type[0] : def.type
        const title = def.title || key
        const description = def.description || ''

        // Determine if field is required
        let isRequired = groupRequired.includes(key)
        if (!isRequired && schema?.groups) {
            isRequired = Object.values(schema.groups).some(group =>
                group.required && group.required.includes(key)
            )
        }
        if (!isRequired && schema?.required) {
            isRequired = schema.required.includes(key)
        }

        // Get validation state for this property
        const validation = validationResults[key]
        const isValidating = validatingProperties.has(key)

        const handleChange = (newValue) => {
            handlePropertyChange(key, newValue)
        }

        const handleBlur = (e) => {
            // Validation logic would go here
        }
        // Use new field system if enabled and field types are loaded
        if (useNewFieldSystem && fieldTypesLoaded) {
            // Handle media fields specially (they already exist)
            if (def.format === 'media') {
                // Use ExpandableImageField for image-only media fields
                if (def.mediaTypes && def.mediaTypes.length === 1 && def.mediaTypes[0] === 'image') {
                    const ImageField = React.lazy(() => import('../form-fields/ExpandableImageField'))

                    // Extract image constraints from field definition
                    // Parse accept attribute if present (fallback for older configs)
                    let parsedMimeTypes = def.allowedMimeTypes || def.allowedTypes || []
                    if (!parsedMimeTypes.length && def.accept) {
                        // Parse accept attribute like "image/*" or "image/jpeg,image/png"
                        if (def.accept === 'image/*') {
                            parsedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
                        } else if (def.accept.includes(',')) {
                            parsedMimeTypes = def.accept.split(',').map(type => type.trim())
                        } else {
                            parsedMimeTypes = [def.accept.trim()]
                        }
                    }

                    const constraints = {
                        allowedMimeTypes: parsedMimeTypes,
                        allowedTypes: parsedMimeTypes, // For backward compatibility
                        minWidth: def.minWidth,
                        maxWidth: def.maxWidth,
                        minHeight: def.minHeight,
                        maxHeight: def.maxHeight,
                        minSize: def.minSize,
                        maxSize: def.maxSize,
                        aspectRatio: def.aspectRatio,
                        exactDimensions: def.exactDimensions
                    }

                    return (
                        <Suspense key={key} fallback={<div className="animate-pulse h-20 bg-gray-200 rounded"></div>}>
                            <ImageField
                                value={value}
                                onChange={handleChange}
                                label={title}
                                description={description}
                                required={isRequired}
                                multiple={def.multiple || type === 'array'}
                                maxItems={def.maxItems}
                                minItems={def.minItems}
                                validation={validation}
                                isValidating={isValidating}
                                showValidation={true}
                                namespace={namespace}
                                constraints={constraints}
                                autoTags={def.autoTags}
                                defaultCollection={def.defaultCollection}
                                maxFiles={def.maxFiles}
                                allowedMimeTypes={parsedMimeTypes}
                            />
                        </Suspense>
                    )
                }

                // Use regular MediaField for other media types
                return (
                    <MediaField
                        key={key}
                        value={value}
                        onChange={handleChange}
                        label={title}
                        description={description}
                        required={isRequired}
                        multiple={def.multiple || type === 'array'}
                        mediaTypes={def.mediaTypes || ['image', 'video', 'audio', 'document']}
                        maxItems={def.maxItems}
                        minItems={def.minItems}
                        validation={validation}
                        isValidating={isValidating}
                        showValidation={true}
                        namespace={namespace}
                    />
                )
            }
            // Use the new field system for other fields
            return (
                <SchemaFieldRenderer
                    key={key}
                    fieldName={key}
                    fieldSchema={def}
                    value={value}
                    onChange={handleChange}
                    validation={validation}
                    isValidating={isValidating}
                    required={isRequired}
                    namespace={namespace}
                />
            )
        }

        // Fallback to original rendering logic
        const commonProps = {
            id: `field-${key}`,
            name: key,
            value: value ?? '',
            onChange: (e) => {
                const v = type === 'number' || type === 'integer' ?
                    Number(e.target.value) :
                    type === 'boolean' ?
                        e.target.checked :
                        e.target.value
                handlePropertyChange(key, v)
            },
            onBlur: handleBlur,
            validation,
            isValidating,
            label: title,
            description,
            required: isRequired,
            showValidation: true
        }

        if (type === 'boolean') {
            return (
                <ValidatedInput
                    key={key}
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => handlePropertyChange(key, e.target.checked)}
                    {...commonProps}
                />
            )
        }

        if (def.enum) {
            return (
                <ValidatedInput
                    key={key}
                    type="select"
                    {...commonProps}
                >
                    <option value="">-- select --</option>
                    {def.enum.map((opt) => (
                        <option key={String(opt)} value={opt}>{String(opt)}</option>
                    ))}
                </ValidatedInput>
            )
        }

        if (type === 'number' || type === 'integer') {
            return (
                <ValidatedInput
                    key={key}
                    type="number"
                    {...commonProps}
                />
            )
        }

        // Handle media fields
        if (def.format === 'media') {
            return (
                <MediaField
                    key={key}
                    value={value}
                    onChange={(mediaValue) => handlePropertyChange(key, mediaValue)}
                    label={title}
                    description={description}
                    required={isRequired}
                    multiple={def.multiple || type === 'array'}
                    mediaTypes={def.mediaTypes || ['image', 'video', 'audio', 'document']}
                    maxItems={def.maxItems}
                    minItems={def.minItems}
                    validation={validation}
                    isValidating={isValidating}
                    showValidation={true}
                    namespace={namespace}
                />
            )
        }

        // default: string or others as text
        return (
            <ValidatedInput
                key={key}
                type={def.format === 'textarea' ? 'textarea' : 'text'}
                rows={def.format === 'textarea' ? 3 : undefined}
                {...commonProps}
            />
        )
    }

    // Get ordered property keys based on schema's propertyOrder
    const getOrderedPropertyKeys = () => {
        const propertyOrder = schema?.propertyOrder || []
        const allKeys = Object.keys(properties)

        if (propertyOrder.length > 0) {
            // Use propertyOrder, then add any missing keys
            const orderedKeys = [...propertyOrder.filter(key => properties[key])]
            const missingKeys = allKeys.filter(key => !propertyOrder.includes(key))
            return [...orderedKeys, ...missingKeys]
        }

        return allKeys
    }

    if (loading) {
        return (
            <div className="p-6 bg-white rounded-lg shadow">
                <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>Loading form schema...</span>
                </div>
            </div>
        )
    }

    if (error) {
        return <div className="p-6 bg-red-50 border border-red-200 rounded">{error}</div>
    }

    if (!schema) {
        return <div className="p-6 bg-white rounded-lg shadow">No schema configured.</div>
    }

    // Render grouped or non-grouped schema
    if (schema.groups) {
        return (
            <div className="space-y-8">
                {Object.entries(schema.groups).map(([groupKey, group]) => (
                    <div key={groupKey} className="space-y-4">
                        <h3 className="text-lg font-medium text-gray-900">{group.title || groupKey}</h3>
                        {group.description && (
                            <p className="text-sm text-gray-600">{group.description}</p>
                        )}
                        <div className="space-y-4">
                            {Object.keys(group.properties || {}).map(key =>
                                renderField(key, group.properties[key], group.required || [])
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    // Render non-grouped schema
    return (
        <div className="space-y-4">
            {getOrderedPropertyKeys().map(key =>
                renderField(key, properties[key])
            )}
        </div>
    )
}

EnhancedSchemaDrivenForm.displayName = 'EnhancedSchemaDrivenForm'

export default EnhancedSchemaDrivenForm
