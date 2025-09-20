import { Operation } from '../types/operations';
import { AppState } from '../types/state';

/**
 * Operation Logger and Replay System
 * Records operations and allows replay for debugging
 */

export interface LoggedOperation {
    id: string;
    operation: Operation;
    timestamp: string;
    duration: number;
    success: boolean;
    error?: Error;
    stateBefore: AppState;
    stateAfter: AppState;
    metadata: {
        userAgent: string;
        url: string;
        userId?: string;
        sessionId: string;
    };
}

export interface ReplaySession {
    id: string;
    name: string;
    operations: LoggedOperation[];
    startTime: string;
    endTime?: string;
    status: 'recording' | 'completed' | 'replaying';
}

export class OperationLogger {
    private sessions: Map<string, ReplaySession> = new Map();
    private currentSession: ReplaySession | null = null;
    private isReplaying: boolean = false;
    private replaySpeed: number = 1; // 1x speed

    /**
     * Start recording a new session
     */
    startRecording(sessionName: string = 'Debug Session'): string {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const session: ReplaySession = {
            id: sessionId,
            name: sessionName,
            operations: [],
            startTime: new Date().toISOString(),
            status: 'recording'
        };

        this.sessions.set(sessionId, session);
        this.currentSession = session;

        console.log(`🎬 Started recording session: ${sessionName} (${sessionId})`);
        return sessionId;
    }

    /**
     * Stop recording current session
     */
    stopRecording(): ReplaySession | null {
        if (!this.currentSession) return null;

        this.currentSession.status = 'completed';
        this.currentSession.endTime = new Date().toISOString();

        const session = this.currentSession;
        this.currentSession = null;

        console.log(`⏹️ Stopped recording session: ${session.name} (${session.operations.length} operations)`);
        return session;
    }

    /**
     * Log an operation to current session
     */
    logOperation(
        operation: Operation,
        stateBefore: AppState,
        stateAfter: AppState,
        duration: number,
        success: boolean,
        error?: Error
    ): void {
        if (!this.currentSession || this.currentSession.status !== 'recording') return;

        const loggedOperation: LoggedOperation = {
            id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            operation,
            timestamp: new Date().toISOString(),
            duration,
            success,
            error,
            stateBefore: JSON.parse(JSON.stringify(stateBefore)), // Deep clone
            stateAfter: JSON.parse(JSON.stringify(stateAfter)), // Deep clone
            metadata: {
                userAgent: navigator.userAgent,
                url: window.location.href,
                sessionId: this.currentSession.id
            }
        };

        this.currentSession.operations.push(loggedOperation);
    }

    /**
     * Replay a session
     */
    async replaySession(
        sessionId: string, 
        onOperation?: (operation: LoggedOperation, index: number) => Promise<void>,
        speed: number = 1
    ): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        if (this.isReplaying) {
            throw new Error('Already replaying a session');
        }

        this.isReplaying = true;
        this.replaySpeed = speed;
        session.status = 'replaying';

        console.log(`▶️ Replaying session: ${session.name} (${session.operations.length} operations at ${speed}x speed)`);

        try {
            for (let i = 0; i < session.operations.length; i++) {
                const loggedOp = session.operations[i];
                
                console.log(`🔄 Replaying operation ${i + 1}/${session.operations.length}: ${loggedOp.operation.type}`);

                // Call operation callback if provided
                if (onOperation) {
                    await onOperation(loggedOp, i);
                }

                // Wait between operations (scaled by speed)
                if (i < session.operations.length - 1) {
                    const nextOp = session.operations[i + 1];
                    const delay = new Date(nextOp.timestamp).getTime() - new Date(loggedOp.timestamp).getTime();
                    const scaledDelay = Math.max(delay / speed, 10); // Minimum 10ms delay
                    
                    await new Promise(resolve => setTimeout(resolve, scaledDelay));
                }
            }

            console.log(`✅ Session replay completed: ${session.name}`);
        } catch (error) {
            console.error(`❌ Session replay failed: ${session.name}`, error);
            throw error;
        } finally {
            this.isReplaying = false;
            session.status = 'completed';
        }
    }

    /**
     * Export session data
     */
    exportSession(sessionId: string): string {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        const exportData = {
            session,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Import session data
     */
    importSession(sessionData: string): string {
        try {
            const data = JSON.parse(sessionData);
            const session = data.session;
            
            if (!session || !session.id) {
                throw new Error('Invalid session data');
            }

            this.sessions.set(session.id, session);
            console.log(`📥 Imported session: ${session.name} (${session.operations.length} operations)`);
            
            return session.id;
        } catch (error) {
            console.error('❌ Failed to import session:', error);
            throw error;
        }
    }

    /**
     * Get all sessions
     */
    getSessions(): ReplaySession[] {
        return Array.from(this.sessions.values());
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): ReplaySession | null {
        return this.sessions.get(sessionId) || null;
    }

    /**
     * Delete session
     */
    deleteSession(sessionId: string): boolean {
        const deleted = this.sessions.delete(sessionId);
        if (deleted) {
            console.log(`🗑️ Deleted session: ${sessionId}`);
        }
        return deleted;
    }

    /**
     * Clear all sessions
     */
    clearAllSessions(): void {
        this.sessions.clear();
        this.currentSession = null;
        console.log('🧹 Cleared all recording sessions');
    }

    /**
     * Get current recording status
     */
    getRecordingStatus(): {
        isRecording: boolean;
        isReplaying: boolean;
        currentSession: ReplaySession | null;
        sessionCount: number;
    } {
        return {
            isRecording: this.currentSession?.status === 'recording',
            isReplaying: this.isReplaying,
            currentSession: this.currentSession,
            sessionCount: this.sessions.size
        };
    }

    /**
     * Search operations by criteria
     */
    searchOperations(criteria: {
        type?: string;
        success?: boolean;
        minDuration?: number;
        maxDuration?: number;
        dateRange?: { start: string; end: string };
        hasError?: boolean;
    }): LoggedOperation[] {
        let operations: LoggedOperation[] = [];
        
        // Collect operations from all sessions
        this.sessions.forEach(session => {
            operations.push(...session.operations);
        });

        // Apply filters
        return operations.filter(op => {
            if (criteria.type && op.operation.type !== criteria.type) return false;
            if (criteria.success !== undefined && op.success !== criteria.success) return false;
            if (criteria.minDuration && op.duration < criteria.minDuration) return false;
            if (criteria.maxDuration && op.duration > criteria.maxDuration) return false;
            if (criteria.hasError !== undefined && Boolean(op.error) !== criteria.hasError) return false;
            
            if (criteria.dateRange) {
                const opTime = new Date(op.timestamp).getTime();
                const startTime = new Date(criteria.dateRange.start).getTime();
                const endTime = new Date(criteria.dateRange.end).getTime();
                if (opTime < startTime || opTime > endTime) return false;
            }
            
            return true;
        });
    }
}
