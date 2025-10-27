import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Auto-save hook with countdown timer
 * 
 * Provides debounced auto-save functionality with visual countdown feedback.
 * 
 * @param {Object} options - Configuration options
 * @param {Function} options.onSave - Function to call when auto-saving
 * @param {number} options.delay - Delay in milliseconds before auto-save (default: 3000)
 * @param {boolean} options.isDirty - Whether there are unsaved changes
 * @param {boolean} options.enabled - Whether auto-save is enabled (default: true)
 * 
 * @returns {Object} - Auto-save state and controls
 * @returns {number|null} countdown - Current countdown value (3, 2, 1, or null)
 * @returns {string} saveStatus - Current save status: 'idle', 'countdown', 'saving', 'saved', 'error'
 * @returns {Function} triggerManualSave - Manually trigger save and cancel countdown
 * @returns {Function} resetCountdown - Reset countdown to initial value
 * @returns {Function} cancelAutoSave - Cancel pending auto-save
 */
export const useAutoSave = ({
    onSave,
    delay = 3000,
    isDirty = false,
    enabled = true
}) => {
    const [countdown, setCountdown] = useState(null);
    const [saveStatus, setSaveStatus] = useState('idle');

    const countdownTimerRef = useRef(null);
    const saveTimeoutRef = useRef(null);
    const isSavingRef = useRef(false);
    const initialDelaySeconds = Math.floor(delay / 1000);

    // Cancel all timers
    const cancelTimers = useCallback(() => {
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
        }
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }
    }, []);

    // Cancel auto-save
    const cancelAutoSave = useCallback(() => {
        cancelTimers();
        setCountdown(null);
        if (saveStatus === 'countdown') {
            setSaveStatus('idle');
        }
    }, [cancelTimers, saveStatus]);

    // Reset countdown to initial value (for debouncing)
    const resetCountdown = useCallback(() => {
        if (!enabled || !isDirty) return;

        cancelTimers();
        setCountdown(initialDelaySeconds);
        setSaveStatus('countdown');

        let currentCount = initialDelaySeconds;

        // Set up interval to countdown
        countdownTimerRef.current = setInterval(() => {
            currentCount -= 1;

            if (currentCount > 0) {
                setCountdown(currentCount);
            } else {
                // Countdown reached 0, trigger save
                clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = null;
                setCountdown(null);
                setSaveStatus('saving');

                // Trigger save
                if (onSave && !isSavingRef.current) {
                    isSavingRef.current = true;

                    Promise.resolve(onSave())
                        .then(() => {
                            isSavingRef.current = false;
                            setSaveStatus('saved');
                            // Show "saved" status briefly before going back to idle
                            setTimeout(() => {
                                setSaveStatus('idle');
                            }, 2000);
                        })
                        .catch((error) => {
                            console.error('Auto-save failed:', error);
                            isSavingRef.current = false;
                            setSaveStatus('error');
                            // Show error briefly before going back to idle
                            setTimeout(() => {
                                setSaveStatus('idle');
                            }, 3000);
                        });
                }
            }
        }, 1000); // Update every second
    }, [enabled, isDirty, initialDelaySeconds, onSave, cancelTimers]);

    // Trigger manual save (cancels auto-save countdown)
    const triggerManualSave = useCallback(async () => {
        cancelAutoSave();
        setSaveStatus('saving');
        isSavingRef.current = true;

        try {
            await onSave();
            isSavingRef.current = false;
            setSaveStatus('saved');
            setTimeout(() => {
                setSaveStatus('idle');
            }, 2000);
        } catch (error) {
            console.error('Manual save failed:', error);
            isSavingRef.current = false;
            setSaveStatus('error');
            setTimeout(() => {
                setSaveStatus('idle');
            }, 3000);
        }
    }, [cancelAutoSave, onSave]);

    // Watch for isDirty changes to start/stop countdown
    useEffect(() => {
        if (!enabled) {
            cancelTimers();
            setCountdown(null);
            setSaveStatus('idle');
            return;
        }

        if (isDirty && !isSavingRef.current && saveStatus !== 'saving') {
            // Start or reset countdown when dirty
            resetCountdown();
        } else if (!isDirty) {
            // Cancel countdown when no longer dirty
            cancelAutoSave();
        }

        // Cleanup on unmount
        return () => {
            cancelTimers();
        };
    }, [isDirty, enabled, resetCountdown, cancelAutoSave, cancelTimers, saveStatus]);

    return {
        countdown,
        saveStatus,
        triggerManualSave,
        resetCountdown,
        cancelAutoSave
    };
};

export default useAutoSave;

