import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { extractErrorMessage } from '../../utils/errorHandling'
import { NotificationProvider } from '../NotificationManager'

describe('PageTreeNode Slug Error Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should extract user-friendly error message from slug conflict error', () => {
        // Simulate the exact error response from the API
        const mockError = new Error('Request failed with status code 400')
        mockError.response = {
            data: {
                slug: ['web page with this slug already exists.']
            }
        }

        const message = extractErrorMessage(mockError, 'Default error')
        expect(message).toBe('slug: web page with this slug already exists.')
    })

    it('should extract user-friendly error message from title validation error', () => {
        // Simulate a title validation error
        const mockError = new Error('Request failed with status code 400')
        mockError.response = {
            data: {
                title: ['This field is required.']
            }
        }

        const message = extractErrorMessage(mockError, 'Default error')
        expect(message).toBe('title: This field is required.')
    })

    it('should extract user-friendly error message from general API error', () => {
        // Simulate a general API error
        const mockError = new Error('Request failed with status code 400')
        mockError.response = {
            data: {
                detail: 'Something went wrong with the request'
            }
        }

        const message = extractErrorMessage(mockError, 'Default error')
        expect(message).toBe('Something went wrong with the request')
    })

    it('should handle multiple field validation errors by showing the first one', () => {
        // Simulate multiple field validation errors
        const mockError = new Error('Request failed with status code 400')
        mockError.response = {
            data: {
                title: ['This field is required.'],
                slug: ['Slug already exists.'],
                description: ['Description is too long.']
            }
        }

        const message = extractErrorMessage(mockError, 'Default error')
        expect(message).toBe('title: This field is required.')
    })

    it('should fall back to error.message when no API response fields', () => {
        // Simulate a network error without response data
        const mockError = new Error('Network error occurred')

        const message = extractErrorMessage(mockError, 'Default error')
        expect(message).toBe('Network error occurred')
    })

    it('should use default message when no error details found', () => {
        // Simulate an empty error object
        const mockError = {}

        const message = extractErrorMessage(mockError, 'Default error')
        expect(message).toBe('Default error')
    })
}) 