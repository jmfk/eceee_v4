import React, { useState } from 'react'
import { FileText, Send } from 'lucide-react'

/**
 * ECEEE Forms Widget Component
 * Renders dynamic forms with schema-based field generation and validation
 */
const FormsWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        title = 'Contact Form',
        description = '',
        fields = [],
        submit_url = '',
        submit_method = 'POST',
        success_message = 'Thank you for your submission!',
        error_message = 'There was an error submitting the form. Please try again.',
        submit_button_text = 'Submit',
        reset_button = false,
        ajax_submit = true,
        redirect_url = '',
        honeypot_protection = true,
        css_framework = 'default'
    } = config

    const [formData, setFormData] = useState({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitStatus, setSubmitStatus] = useState(null) // 'success', 'error', or null
    const [errors, setErrors] = useState({})

    const handleInputChange = (fieldName, value) => {
        setFormData(prev => ({
            ...prev,
            [fieldName]: value
        }))

        // Clear field error when user starts typing
        if (errors[fieldName]) {
            setErrors(prev => ({
                ...prev,
                [fieldName]: null
            }))
        }
    }

    const validateForm = () => {
        const newErrors = {}

        fields.forEach(field => {
            if (field.required && !formData[field.name]) {
                newErrors[field.name] = `${field.label} is required`
            }

            if (field.validation) {
                const value = formData[field.name]
                if (value) {
                    if (field.validation.min_length && value.length < field.validation.min_length) {
                        newErrors[field.name] = `${field.label} must be at least ${field.validation.min_length} characters`
                    }
                    if (field.validation.max_length && value.length > field.validation.max_length) {
                        newErrors[field.name] = `${field.label} must be no more than ${field.validation.max_length} characters`
                    }
                    if (field.validation.pattern && !new RegExp(field.validation.pattern).test(value)) {
                        newErrors[field.name] = `${field.label} format is invalid`
                    }
                }
            }
        })

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!validateForm()) {
            return
        }

        // Check honeypot
        if (honeypot_protection && formData.honeypot) {
            // Silently fail for spam
            return
        }

        setIsSubmitting(true)
        setSubmitStatus(null)

        try {
            if (ajax_submit && submit_url) {
                const response = await fetch(submit_url, {
                    method: submit_method,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify(formData)
                })

                if (response.ok) {
                    setSubmitStatus('success')
                    if (redirect_url) {
                        setTimeout(() => {
                            window.location.href = redirect_url
                        }, 2000)
                    } else {
                        setFormData({})
                    }
                } else {
                    setSubmitStatus('error')
                }
            } else {
                // Fallback for non-AJAX submission
                setSubmitStatus('success')
                setFormData({})
            }
        } catch (error) {
            console.error('Form submission error:', error)
            setSubmitStatus('error')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleReset = () => {
        setFormData({})
        setErrors({})
        setSubmitStatus(null)
    }

    const renderField = (field) => {
        const fieldId = `field_${field.name}`
        const hasError = errors[field.name]
        const fieldValue = formData[field.name] || field.default_value || ''

        const baseInputClass = `w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${hasError ? 'border-red-500' : 'border-gray-300'
            }`

        switch (field.type) {
            case 'textarea':
                return (
                    <textarea
                        id={fieldId}
                        name={field.name}
                        value={fieldValue}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                        rows={4}
                        className={baseInputClass}
                    />
                )

            case 'select':
                return (
                    <select
                        id={fieldId}
                        name={field.name}
                        value={fieldValue}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        required={field.required}
                        className={baseInputClass}
                    >
                        {!field.required && <option value="">Select an option</option>}
                        {field.options?.map((option, index) => (
                            <option key={index} value={option}>{option}</option>
                        ))}
                    </select>
                )

            case 'checkbox':
                if (field.options) {
                    return (
                        <div className="checkbox-group space-y-2">
                            {field.options.map((option, index) => (
                                <div key={index} className="checkbox-item flex items-center">
                                    <input
                                        type="checkbox"
                                        id={`${fieldId}_${index}`}
                                        name={field.name}
                                        value={option}
                                        checked={Array.isArray(fieldValue) ? fieldValue.includes(option) : false}
                                        onChange={(e) => {
                                            const currentValues = Array.isArray(fieldValue) ? fieldValue : []
                                            if (e.target.checked) {
                                                handleInputChange(field.name, [...currentValues, option])
                                            } else {
                                                handleInputChange(field.name, currentValues.filter(v => v !== option))
                                            }
                                        }}
                                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor={`${fieldId}_${index}`} className="text-sm text-gray-700">{option}</label>
                                </div>
                            ))}
                        </div>
                    )
                } else {
                    return (
                        <div className="checkbox-item flex items-center">
                            <input
                                type="checkbox"
                                id={fieldId}
                                name={field.name}
                                checked={!!fieldValue}
                                onChange={(e) => handleInputChange(field.name, e.target.checked)}
                                required={field.required}
                                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor={fieldId} className="text-sm text-gray-700">{field.label}</label>
                        </div>
                    )
                }

            case 'radio':
                return (
                    <div className="radio-group space-y-2">
                        {field.options?.map((option, index) => (
                            <div key={index} className="radio-item flex items-center">
                                <input
                                    type="radio"
                                    id={`${fieldId}_${index}`}
                                    name={field.name}
                                    value={option}
                                    checked={fieldValue === option}
                                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                                    required={field.required}
                                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                />
                                <label htmlFor={`${fieldId}_${index}`} className="text-sm text-gray-700">{option}</label>
                            </div>
                        ))}
                    </div>
                )

            default:
                return (
                    <input
                        type={field.type}
                        id={fieldId}
                        name={field.name}
                        value={fieldValue}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                        className={baseInputClass}
                    />
                )
        }
    }

    if (mode === 'editor') {
        return (
            <div className="forms-widget-editor p-4">
                <div className="forms-widget bg-white border border-gray-200 rounded-lg p-6 max-w-2xl mx-auto">
                    <div className="form-header mb-6">
                        <h2 className="form-title text-2xl font-semibold text-gray-900 text-center">{title}</h2>
                        {description && (
                            <p className="form-description text-gray-600 text-center mt-2">{description}</p>
                        )}
                    </div>

                    {fields.length > 0 ? (
                        <form onSubmit={handleSubmit} className="widget-form space-y-6">
                            {honeypot_protection && (
                                <div style={{ display: 'none' }}>
                                    <label htmlFor="honeypot">Leave this field empty</label>
                                    <input
                                        type="text"
                                        name="honeypot"
                                        id="honeypot"
                                        tabIndex="-1"
                                        autoComplete="off"
                                        value={formData.honeypot || ''}
                                        onChange={(e) => handleInputChange('honeypot', e.target.value)}
                                    />
                                </div>
                            )}

                            {fields.map((field, index) => (
                                <div key={index} className={`form-group ${field.css_class || ''}`}>
                                    {field.type !== 'checkbox' || field.options ? (
                                        <label htmlFor={`field_${field.name}`} className="block text-sm font-medium text-gray-700 mb-1">
                                            {field.label}
                                            {field.required && <span className="text-red-500 ml-1">*</span>}
                                        </label>
                                    ) : null}

                                    {field.help_text && (
                                        <p className="form-help text-sm text-gray-500 mb-2">{field.help_text}</p>
                                    )}

                                    {renderField(field)}

                                    {errors[field.name] && (
                                        <p className="form-error text-sm text-red-600 mt-1">{errors[field.name]}</p>
                                    )}
                                </div>
                            ))}

                            <div className="form-actions flex justify-center space-x-4 pt-4">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="submit-button bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="h-4 w-4 mr-2" />
                                            {submit_button_text}
                                        </>
                                    )}
                                </button>

                                {reset_button && (
                                    <button
                                        type="button"
                                        onClick={handleReset}
                                        className="reset-button bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition-colors"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>

                            {submitStatus === 'success' && (
                                <div className="form-success bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-center">
                                    {success_message}
                                </div>
                            )}

                            {submitStatus === 'error' && (
                                <div className="form-error bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-center">
                                    {error_message}
                                </div>
                            )}
                        </form>
                    ) : (
                        <div className="text-center text-gray-500 py-8">
                            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            No form fields configured
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="forms-widget bg-white border border-gray-200 rounded-lg p-6 max-w-2xl mx-auto">
            <div className="form-header mb-6">
                <h2 className="form-title text-2xl font-semibold text-gray-900 text-center">{title}</h2>
                {description && (
                    <p className="form-description text-gray-600 text-center mt-2">{description}</p>
                )}
            </div>

            {fields.length > 0 ? (
                <form onSubmit={handleSubmit} className="widget-form space-y-6">
                    {honeypot_protection && (
                        <div style={{ display: 'none' }}>
                            <label htmlFor="honeypot">Leave this field empty</label>
                            <input
                                type="text"
                                name="honeypot"
                                id="honeypot"
                                tabIndex="-1"
                                autoComplete="off"
                                value={formData.honeypot || ''}
                                onChange={(e) => handleInputChange('honeypot', e.target.value)}
                            />
                        </div>
                    )}

                    {fields.map((field, index) => (
                        <div key={index} className={`form-group ${field.css_class || ''}`}>
                            {field.type !== 'checkbox' || field.options ? (
                                <label htmlFor={`field_${field.name}`} className="block text-sm font-medium text-gray-700 mb-1">
                                    {field.label}
                                    {field.required && <span className="text-red-500 ml-1">*</span>}
                                </label>
                            ) : null}

                            {field.help_text && (
                                <p className="form-help text-sm text-gray-500 mb-2">{field.help_text}</p>
                            )}

                            {renderField(field)}

                            {errors[field.name] && (
                                <p className="form-error text-sm text-red-600 mt-1">{errors[field.name]}</p>
                            )}
                        </div>
                    ))}

                    <div className="form-actions flex justify-center space-x-4 pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="submit-button bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4 mr-2" />
                                    {submit_button_text}
                                </>
                            )}
                        </button>

                        {reset_button && (
                            <button
                                type="button"
                                onClick={handleReset}
                                className="reset-button bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition-colors"
                            >
                                Reset
                            </button>
                        )}
                    </div>

                    {submitStatus === 'success' && (
                        <div className="form-success bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-center">
                            {success_message}
                        </div>
                    )}

                    {submitStatus === 'error' && (
                        <div className="form-error bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-center">
                            {error_message}
                        </div>
                    )}
                </form>
            ) : (
                <div className="text-center text-gray-500 py-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    No form fields configured
                </div>
            )}
        </div>
    )
}

// === COLOCATED METADATA ===
FormsWidget.displayName = 'FormsWidget'
FormsWidget.widgetType = 'easy_widgets.FormsWidget'

// Default configuration
FormsWidget.defaultConfig = {
    title: 'Contact Form',
    description: 'Get in touch with us using the form below.',
    fields: [
        {
            name: 'name',
            label: 'Full Name',
            type: 'text',
            required: true,
            placeholder: 'Enter your full name'
        },
        {
            name: 'email',
            label: 'Email Address',
            type: 'email',
            required: true,
            placeholder: 'Enter your email address'
        },
        {
            name: 'subject',
            label: 'Subject',
            type: 'text',
            required: true,
            placeholder: 'What is this regarding?'
        },
        {
            name: 'message',
            label: 'Message',
            type: 'textarea',
            required: true,
            placeholder: 'Enter your message here...'
        }
    ],
    submit_url: '',
    submit_method: 'POST',
    success_message: 'Thank you for your message! We\'ll get back to you soon.',
    error_message: 'There was an error submitting the form. Please try again.',
    submit_button_text: 'Send Message',
    reset_button: false,
    ajax_submit: true,
    honeypot_protection: true
}

// Display metadata
FormsWidget.metadata = {
    name: 'ECEEE Forms',
    description: 'Dynamic forms with schema-based field generation, validation, and AJAX submission',
    category: 'form',
    icon: FileText,
    tags: ['eceee', 'form', 'contact', 'input', 'validation', 'submit', 'fields']
}

export default FormsWidget
