import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import useLocalFormState from '../useLocalFormState'

describe('useLocalFormState', () => {
    const initialData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('initializes with provided data', () => {
        const { result } = renderHook(() => useLocalFormState(initialData))

        expect(result.current.getFormData()).toEqual(initialData)
        expect(result.current.isDirty).toBe(false)
        expect(result.current.isFormValid).toBe(true)
    })

    test('handles field changes without re-renders', async () => {
        let renderCount = 0
        const onChange = vi.fn()

        const { result } = renderHook(() => {
            renderCount++
            return useLocalFormState(initialData, { onChange })
        })

        const initialRenderCount = renderCount

        // Change a field value
        act(() => {
            result.current.handleFieldChange('name', 'Jane Doe')
        })

        // Should not cause additional renders
        expect(renderCount).toBe(initialRenderCount)

        // Data should be updated in ref
        expect(result.current.getFormData()).toEqual({
            ...initialData,
            name: 'Jane Doe'
        })

        // Wait for debounced onChange
        await new Promise(resolve => setTimeout(resolve, 350))
        expect(onChange).toHaveBeenCalledWith(
            { ...initialData, name: 'Jane Doe' },
            'name',
            'Jane Doe'
        )
    })

    test('tracks dirty state correctly', () => {
        const { result } = renderHook(() => useLocalFormState(initialData))

        expect(result.current.isDirty).toBe(false)

        act(() => {
            result.current.handleFieldChange('name', 'Jane Doe')
        })

        expect(result.current.isDirty).toBe(true)
    })

    test('handles form submission with validation', async () => {
        const onSubmit = vi.fn().mockResolvedValue()
        const onValidate = vi.fn().mockResolvedValue({
            isValid: true,
            errors: [],
            warnings: []
        })

        const { result } = renderHook(() =>
            useLocalFormState(initialData, { onSubmit, onValidate, validateOnSubmit: true })
        )

        await act(async () => {
            await result.current.handleSubmit()
        })

        expect(onValidate).toHaveBeenCalled()
        expect(onSubmit).toHaveBeenCalledWith(initialData)
        expect(result.current.isSubmitting).toBe(false)
    })

    test('handles form submission errors', async () => {
        const onSubmit = vi.fn().mockRejectedValue(new Error('Submission failed'))
        const onValidate = vi.fn().mockResolvedValue({
            isValid: true,
            errors: [],
            warnings: []
        })

        const { result } = renderHook(() =>
            useLocalFormState(initialData, { onSubmit, onValidate, validateOnSubmit: true })
        )

        await act(async () => {
            try {
                await result.current.handleSubmit()
            } catch (error) {
                // Expected to throw
            }
        })

        expect(result.current.submitError).toBe('Submission failed')
        expect(result.current.isSubmitting).toBe(false)
    })

    test('resets form correctly', () => {
        const { result } = renderHook(() => useLocalFormState(initialData))

        // Make some changes
        act(() => {
            result.current.handleFieldChange('name', 'Jane Doe')
            result.current.handleFieldChange('email', 'jane@example.com')
        })

        expect(result.current.isDirty).toBe(true)

        // Reset form
        act(() => {
            result.current.resetForm()
        })

        expect(result.current.getFormData()).toEqual(initialData)
        expect(result.current.isDirty).toBe(false)
    })

    test('updates form data programmatically', () => {
        const { result } = renderHook(() => useLocalFormState(initialData))

        const newData = { name: 'Updated Name', email: 'updated@example.com' }

        act(() => {
            result.current.updateFormData(newData)
        })

        expect(result.current.getFormData()).toEqual({
            ...initialData,
            ...newData
        })
    })

    test('gets and sets individual field values', () => {
        const { result } = renderHook(() => useLocalFormState(initialData))

        expect(result.current.getFieldValue('name')).toBe('John Doe')

        act(() => {
            result.current.setFieldValue('name', 'New Name')
        })

        expect(result.current.getFieldValue('name')).toBe('New Name')
    })

    test('handles validation for individual fields', async () => {
        const onValidate = vi.fn().mockResolvedValue({
            isValid: false,
            errors: ['Name is required'],
            warnings: []
        })

        const { result } = renderHook(() =>
            useLocalFormState(initialData, { onValidate, validateOnChange: true })
        )

        const validation = await act(async () => {
            return await result.current.handleFieldValidation('name', '')
        })

        expect(validation).toEqual({
            isValid: false,
            errors: ['Name is required'],
            warnings: []
        })
        expect(onValidate).toHaveBeenCalledWith('name', '', initialData)
    })

    test('validates all fields correctly', async () => {
        const onValidate = vi.fn()
            .mockResolvedValueOnce({ isValid: true, errors: [], warnings: [] })
            .mockResolvedValueOnce({ isValid: true, errors: [], warnings: [] })
            .mockResolvedValueOnce({ isValid: false, errors: ['Invalid age'], warnings: [] })

        const { result } = renderHook(() =>
            useLocalFormState(initialData, { onValidate })
        )

        const isValid = await act(async () => {
            return await result.current.validateAllFields()
        })

        expect(isValid).toBe(false)
        expect(onValidate).toHaveBeenCalledTimes(3)
    })
})
