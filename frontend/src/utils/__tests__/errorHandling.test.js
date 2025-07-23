import { describe, it, expect } from 'vitest'
import { extractErrorMessage } from '../errorHandling'

describe('extractErrorMessage', () => {
    it('should extract detail from API response', () => {
        const error = {
            response: {
                data: {
                    detail: 'This field is required'
                }
            }
        }

        const message = extractErrorMessage(error, 'Default error')
        expect(message).toBe('This field is required')
    })

    it('should extract message from API response', () => {
        const error = {
            response: {
                data: {
                    message: 'Validation failed'
                }
            }
        }

        const message = extractErrorMessage(error, 'Default error')
        expect(message).toBe('Validation failed')
    })

    it('should extract error from API response', () => {
        const error = {
            response: {
                data: {
                    error: 'Something went wrong'
                }
            }
        }

        const message = extractErrorMessage(error, 'Default error')
        expect(message).toBe('Something went wrong')
    })

    it('should extract field-specific validation errors', () => {
        const error = {
            response: {
                data: {
                    slug: ['web page with this slug already exists.']
                }
            }
        }

        const message = extractErrorMessage(error, 'Default error')
        expect(message).toBe('slug: web page with this slug already exists.')
    })

    it('should extract first message from field-specific validation errors', () => {
        const error = {
            response: {
                data: {
                    title: ['This field is required.', 'Title must be unique.'],
                    slug: ['Slug already exists.']
                }
            }
        }

        const message = extractErrorMessage(error, 'Default error')
        expect(message).toBe('title: This field is required.')
    })

    it('should use error.message when no API response fields', () => {
        const error = new Error('Network error')

        const message = extractErrorMessage(error, 'Default error')
        expect(message).toBe('Network error')
    })

    it('should use default message when no error details found', () => {
        const error = {}

        const message = extractErrorMessage(error, 'Default error')
        expect(message).toBe('Default error')
    })

    it('should handle string errors', () => {
        const error = 'Simple string error'

        const message = extractErrorMessage(error, 'Default error')
        expect(message).toBe('Simple string error')
    })

    it('should handle null/undefined errors', () => {
        const message1 = extractErrorMessage(null, 'Default error')
        expect(message1).toBe('Default error')

        const message2 = extractErrorMessage(undefined, 'Default error')
        expect(message2).toBe('Default error')
    })

    it('should prioritize detail over other fields', () => {
        const error = {
            response: {
                data: {
                    detail: 'This is the detail',
                    message: 'This is the message',
                    error: 'This is the error'
                }
            }
        }

        const message = extractErrorMessage(error, 'Default error')
        expect(message).toBe('This is the detail')
    })

    it('should handle non-nested error fields', () => {
        const error = {
            detail: 'Direct detail field',
            message: 'Direct message field'
        }

        const message = extractErrorMessage(error, 'Default error')
        expect(message).toBe('Direct detail field')
    })
}) 