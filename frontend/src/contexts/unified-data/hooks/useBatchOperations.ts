import { useCallback, useMemo, useState } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { Operation } from '../types/operations';

export interface BatchOperation {
    id: string;
    operation: Operation;
    status: 'pending' | 'success' | 'error';
    error?: Error;
    result?: any;
}

export interface UseBatchOperationsResult {
    // Batch state
    operations: BatchOperation[];
    isProcessing: boolean;
    completedCount: number;
    errorCount: number;
    totalCount: number;
    
    // Operations
    addOperation: (operation: Operation) => string;
    removeOperation: (operationId: string) => void;
    clearOperations: () => void;
    executeBatch: () => Promise<BatchOperation[]>;
    executeOperation: (operationId: string) => Promise<void>;
    
    // Utilities
    getOperation: (operationId: string) => BatchOperation | null;
    getSuccessfulOperations: () => BatchOperation[];
    getFailedOperations: () => BatchOperation[];
    canExecute: boolean;
    progress: number;
}

export function useBatchOperations(): UseBatchOperationsResult {
    const { dispatch } = useUnifiedData();
    const [operations, setOperations] = useState<BatchOperation[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // Derived state
    const completedCount = operations.filter(op => op.status !== 'pending').length;
    const errorCount = operations.filter(op => op.status === 'error').length;
    const totalCount = operations.length;
    const canExecute = totalCount > 0 && !isProcessing;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    // Operations
    const addOperation = useCallback((operation: Operation): string => {
        const id = `batch_op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const batchOperation: BatchOperation = {
            id,
            operation,
            status: 'pending'
        };

        setOperations(prev => [...prev, batchOperation]);
        return id;
    }, []);

    const removeOperation = useCallback((operationId: string) => {
        setOperations(prev => prev.filter(op => op.id !== operationId));
    }, []);

    const clearOperations = useCallback(() => {
        if (!isProcessing) {
            setOperations([]);
        }
    }, [isProcessing]);

    const executeOperation = useCallback(async (operationId: string) => {
        const operation = operations.find(op => op.id === operationId);
        if (!operation) return;

        try {
            setOperations(prev => prev.map(op => 
                op.id === operationId 
                    ? { ...op, status: 'pending' as const }
                    : op
            ));

            const result = await dispatch(operation.operation);

            setOperations(prev => prev.map(op => 
                op.id === operationId 
                    ? { ...op, status: 'success' as const, result }
                    : op
            ));
        } catch (error) {
            setOperations(prev => prev.map(op => 
                op.id === operationId 
                    ? { ...op, status: 'error' as const, error: error as Error }
                    : op
            ));
            throw error;
        }
    }, [operations, dispatch]);

    const executeBatch = useCallback(async (): Promise<BatchOperation[]> => {
        if (isProcessing || operations.length === 0) {
            return operations;
        }

        setIsProcessing(true);

        try {
            // Reset all operations to pending
            setOperations(prev => prev.map(op => ({ 
                ...op, 
                status: 'pending' as const,
                error: undefined,
                result: undefined
            })));

            // Execute all operations
            const results: BatchOperation[] = [];
            
            for (const operation of operations) {
                try {
                    const result = await dispatch(operation.operation);
                    const successOp = { 
                        ...operation, 
                        status: 'success' as const, 
                        result 
                    };
                    results.push(successOp);
                    
                    setOperations(prev => prev.map(op => 
                        op.id === operation.id ? successOp : op
                    ));
                } catch (error) {
                    const errorOp = { 
                        ...operation, 
                        status: 'error' as const, 
                        error: error as Error 
                    };
                    results.push(errorOp);
                    
                    setOperations(prev => prev.map(op => 
                        op.id === operation.id ? errorOp : op
                    ));
                }
            }

            return results;
        } finally {
            setIsProcessing(false);
        }
    }, [operations, dispatch, isProcessing]);

    // Utilities
    const getOperation = useCallback((operationId: string): BatchOperation | null => {
        return operations.find(op => op.id === operationId) || null;
    }, [operations]);

    const getSuccessfulOperations = useCallback((): BatchOperation[] => {
        return operations.filter(op => op.status === 'success');
    }, [operations]);

    const getFailedOperations = useCallback((): BatchOperation[] => {
        return operations.filter(op => op.status === 'error');
    }, [operations]);

    return useMemo(() => ({
        operations,
        isProcessing,
        completedCount,
        errorCount,
        totalCount,
        canExecute,
        progress,
        addOperation,
        removeOperation,
        clearOperations,
        executeBatch,
        executeOperation,
        getOperation,
        getSuccessfulOperations,
        getFailedOperations
    }), [
        operations,
        isProcessing,
        completedCount,
        errorCount,
        totalCount,
        canExecute,
        progress,
        addOperation,
        removeOperation,
        clearOperations,
        executeBatch,
        executeOperation,
        getOperation,
        getSuccessfulOperations,
        getFailedOperations
    ]);
}
