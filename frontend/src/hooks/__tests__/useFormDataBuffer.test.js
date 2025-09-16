import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { useFormDataBuffer, useFormDataBufferWithRef } from '../useFormDataBuffer';

describe('useFormDataBuffer', () => {
    const initialData = {
        name: 'John Doe',
        email: 'john@example.com',
        profile: {
            age: 30,
            city: 'New York'
        }
    };

    let onSaveMock;
    let onDirtyChangeMock;
    let onRealTimeUpdateMock;

    beforeEach(() => {
        onSaveMock = jest.fn();
        onDirtyChangeMock = jest.fn();
        onRealTimeUpdateMock = jest.fn();
    });

    it('should initialize with provided data', () => {
        const { result } = renderHook(() =>
            useFormDataBuffer(initialData, onSaveMock)
        );

        expect(result.current.getCurrentData()).toEqual(initialData);
        expect(result.current.isDirty()).toBe(false);
        expect(result.current.getDirtyFields()).toEqual([]);
    });

    it('should update field values without re-rendering', () => {
        const { result, rerender } = renderHook(() =>
            useFormDataBuffer(initialData, onSaveMock)
        );

        const renderCount = jest.fn();
        renderHook(() => renderCount());

        act(() => {
            result.current.updateField('name', 'Jane Doe');
        });

        expect(result.current.getCurrentData().name).toBe('Jane Doe');
        expect(result.current.isDirty()).toBe(true);
        expect(result.current.getDirtyFields()).toContain('name');
        expect(result.current.isFieldDirty('name')).toBe(true);
        expect(result.current.isFieldDirty('email')).toBe(false);
    });

    it('should handle nested field updates', () => {
        const { result } = renderHook(() =>
            useFormDataBuffer(initialData, onSaveMock)
        );

        act(() => {
            result.current.updateField('profile.age', 31);
        });

        expect(result.current.getCurrentData().profile.age).toBe(31);
        expect(result.current.getFieldValue('profile.age')).toBe(31);
        expect(result.current.isDirty()).toBe(true);
        expect(result.current.isFieldDirty('profile.age')).toBe(true);
    });

    it('should update multiple fields at once', () => {
        const { result } = renderHook(() =>
            useFormDataBuffer(initialData, onSaveMock)
        );

        act(() => {
            result.current.updateFields({
                'name': 'Jane Smith',
                'profile.city': 'Boston'
            });
        });

        expect(result.current.getCurrentData().name).toBe('Jane Smith');
        expect(result.current.getCurrentData().profile.city).toBe('Boston');
        expect(result.current.getDirtyFields()).toEqual(['name', 'profile.city']);
    });

    it('should call onDirtyChange when dirty state changes', () => {
        const { result } = renderHook(() =>
            useFormDataBuffer(initialData, onSaveMock, { onDirtyChange: onDirtyChangeMock })
        );

        act(() => {
            result.current.updateField('name', 'Jane Doe');
        });

        expect(onDirtyChangeMock).toHaveBeenCalledWith(true);

        act(() => {
            result.current.reset();
        });

        expect(onDirtyChangeMock).toHaveBeenCalledWith(false);
    });

    it('should call onRealTimeUpdate on field changes', () => {
        const { result } = renderHook(() =>
            useFormDataBuffer(initialData, onSaveMock, { onRealTimeUpdate: onRealTimeUpdateMock })
        );

        act(() => {
            result.current.updateField('name', 'Jane Doe');
        });

        expect(onRealTimeUpdateMock).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Jane Doe' }),
            'name',
            'Jane Doe'
        );
    });

    it('should save data and reset dirty state', async () => {
        onSaveMock.mockResolvedValue('success');

        const { result } = renderHook(() =>
            useFormDataBuffer(initialData, onSaveMock, { onDirtyChange: onDirtyChangeMock })
        );

        act(() => {
            result.current.updateField('name', 'Jane Doe');
        });

        expect(result.current.isDirty()).toBe(true);

        await act(async () => {
            const saveResult = await result.current.save();
            expect(saveResult).toBe('success');
        });

        expect(onSaveMock).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Jane Doe' })
        );
        expect(result.current.isDirty()).toBe(false);
        expect(onDirtyChangeMock).toHaveBeenCalledWith(false);
    });

    it('should validate data before saving if validator provided', async () => {
        const validator = jest.fn().mockResolvedValue({ isValid: false, error: 'Invalid data' });

        const { result } = renderHook(() =>
            useFormDataBuffer(initialData, onSaveMock, { validator })
        );

        act(() => {
            result.current.updateField('name', '');
        });

        await expect(act(async () => {
            await result.current.save();
        })).rejects.toThrow('Invalid data');

        expect(validator).toHaveBeenCalledWith(expect.objectContaining({ name: '' }));
        expect(onSaveMock).not.toHaveBeenCalled();
    });

    it('should reset to original data', () => {
        const { result } = renderHook(() =>
            useFormDataBuffer(initialData, onSaveMock, { onDirtyChange: onDirtyChangeMock })
        );

        act(() => {
            result.current.updateField('name', 'Jane Doe');
            result.current.updateField('email', 'jane@example.com');
        });

        expect(result.current.isDirty()).toBe(true);

        act(() => {
            result.current.reset();
        });

        expect(result.current.getCurrentData()).toEqual(initialData);
        expect(result.current.isDirty()).toBe(false);
        expect(result.current.getDirtyFields()).toEqual([]);
        expect(onDirtyChangeMock).toHaveBeenCalledWith(false);
    });

    it('should reset to new initial data', () => {
        const newData = { name: 'Bob', email: 'bob@example.com' };

        const { result } = renderHook(() =>
            useFormDataBuffer(initialData, onSaveMock)
        );

        act(() => {
            result.current.updateField('name', 'Jane Doe');
        });

        expect(result.current.isDirty()).toBe(true);

        act(() => {
            result.current.resetTo(newData);
        });

        expect(result.current.getCurrentData()).toEqual(newData);
        expect(result.current.isDirty()).toBe(false);
    });

    it('should get field values using dot notation', () => {
        const { result } = renderHook(() =>
            useFormDataBuffer(initialData, onSaveMock)
        );

        expect(result.current.getFieldValue('name')).toBe('John Doe');
        expect(result.current.getFieldValue('profile.age')).toBe(30);
        expect(result.current.getFieldValue('profile.nonexistent')).toBeUndefined();
    });
});

describe('useFormDataBufferWithRef', () => {
    it('should expose methods via ref', () => {
        const TestComponent = () => {
            const ref = useRef();
            useFormDataBufferWithRef(ref, { name: 'John' }, jest.fn());
            return ref;
        };

        const { result } = renderHook(() => TestComponent());
        const ref = result.current;

        expect(ref.current).toHaveProperty('save');
        expect(ref.current).toHaveProperty('reset');
        expect(ref.current).toHaveProperty('getCurrentData');
        expect(ref.current).toHaveProperty('updateField');
        expect(ref.current).toHaveProperty('isDirty');
    });

    it('should work with imperative calls via ref', () => {
        const TestComponent = () => {
            const ref = useRef();
            const formBuffer = useFormDataBufferWithRef(ref, { name: 'John' }, jest.fn());
            return { ref, formBuffer };
        };

        const { result } = renderHook(() => TestComponent());
        const { ref } = result.current;

        act(() => {
            ref.current.updateField('name', 'Jane');
        });

        expect(ref.current.getCurrentData().name).toBe('Jane');
        expect(ref.current.isDirty()).toBe(true);
    });
});
