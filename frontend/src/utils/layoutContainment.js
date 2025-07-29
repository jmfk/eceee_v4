/**
 * Layout Containment Utilities
 * 
 * Provides utilities for constraining absolutely and fixed positioned elements
 * within layout containers, preventing them from escaping their intended bounds.
 */

import React from 'react';

/**
 * Converts fixed positioned elements to absolute within a container
 * @param {HTMLElement} container - The container element
 * @param {Object} options - Configuration options
 */
export function containFixedElements(container, options = {}) {
    if (!container) {
        console.warn('layoutContainment: No container provided');
        return;
    }

    const {
        selector = '*', // Selector for elements to check
        addContainmentClass = true, // Whether to add containment classes
        logConversions = false, // Whether to log conversions
        preserveOriginal = true // Whether to preserve original positioning in data attributes
    } = options;

    // Find all elements within the container
    const elements = container.querySelectorAll(selector);

    elements.forEach(element => {
        const computedStyle = window.getComputedStyle(element);

        if (computedStyle.position === 'fixed') {
            // Preserve original positioning if requested
            if (preserveOriginal) {
                element.setAttribute('data-original-position', 'fixed');
                element.setAttribute('data-original-top', computedStyle.top);
                element.setAttribute('data-original-right', computedStyle.right);
                element.setAttribute('data-original-bottom', computedStyle.bottom);
                element.setAttribute('data-original-left', computedStyle.left);
            }

            // Add containment class
            if (addContainmentClass) {
                element.classList.add('fixed-contained');
            }

            // Convert fixed to absolute
            element.style.position = 'absolute';

            // Ensure element stays within bounds
            element.style.maxWidth = '100%';
            element.style.maxHeight = '100%';

            if (logConversions) {
                // console.log('layoutContainment: Converted fixed positioned element', element);
            }
        }
    });
}

/**
 * Restores original positioning for elements that were converted
 * @param {HTMLElement} container - The container element
 */
export function restoreOriginalPositioning(container) {
    if (!container) return;

    const convertedElements = container.querySelectorAll('[data-original-position]');

    convertedElements.forEach(element => {
        const originalPosition = element.getAttribute('data-original-position');

        if (originalPosition) {
            element.style.position = originalPosition;

            // Restore original positioning values
            const originalTop = element.getAttribute('data-original-top');
            const originalRight = element.getAttribute('data-original-right');
            const originalBottom = element.getAttribute('data-original-bottom');
            const originalLeft = element.getAttribute('data-original-left');

            if (originalTop) element.style.top = originalTop;
            if (originalRight) element.style.right = originalRight;
            if (originalBottom) element.style.bottom = originalBottom;
            if (originalLeft) element.style.left = originalLeft;

            // Remove data attributes
            element.removeAttribute('data-original-position');
            element.removeAttribute('data-original-top');
            element.removeAttribute('data-original-right');
            element.removeAttribute('data-original-bottom');
            element.removeAttribute('data-original-left');

            // Remove containment class
            element.classList.remove('fixed-contained');
        }
    });
}

/**
 * Applies full containment to a container element
 * @param {HTMLElement} container - The container element
 * @param {Object} options - Configuration options
 */
export function applyContainment(container, options = {}) {
    if (!container) return;

    const {
        enableCSS = true, // Whether to apply CSS containment
        enablePositioning = true, // Whether to handle positioning
        enableScrolling = false, // Whether to allow scrolling
        className = 'layout-containment' // CSS class to apply
    } = options;

    if (enableCSS) {
        // Add containment class
        container.classList.add(className);

        // Apply inline styles as fallback
        if (!container.style.contain) {
            container.style.contain = 'layout style paint';
        }

        if (!container.style.position || container.style.position === 'static') {
            container.style.position = 'relative';
        }

        if (!container.style.isolation) {
            container.style.isolation = 'isolate';
        }

        if (!container.style.transform) {
            container.style.transform = 'translateZ(0)';
        }

        if (enableScrolling) {
            container.style.overflow = 'auto';
        } else {
            container.style.overflow = 'hidden auto';
        }
    }

    if (enablePositioning) {
        containFixedElements(container, options);
    }
}

/**
 * Removes containment from a container element
 * @param {HTMLElement} container - The container element
 */
export function removeContainment(container) {
    if (!container) return;

    // Remove CSS classes
    container.classList.remove('layout-containment', 'layout-containment-scroll', 'template-viewport-contained');

    // Restore original positioning
    restoreOriginalPositioning(container);

    // Remove inline containment styles
    container.style.contain = '';
    container.style.isolation = '';
    container.style.transform = '';
}

/**
 * Creates a MutationObserver to automatically handle new fixed elements
 * @param {HTMLElement} container - The container to observe
 * @param {Object} options - Configuration options
 * @returns {MutationObserver} The observer instance
 */
export function createContainmentObserver(container, options = {}) {
    if (!container) return null;

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        containFixedElements(node, options);
                    }
                });
            }
        });
    });

    observer.observe(container, {
        childList: true,
        subtree: true
    });

    return observer;
}

/**
 * React hook for applying layout containment
 * @param {React.RefObject} containerRef - Ref to the container element
 * @param {Object} options - Configuration options
 */
export function useLayoutContainment(containerRef, options = {}) {
    const {
        enabled = true,
        autoObserve = true
    } = options;

    React.useEffect(() => {
        if (!enabled || !containerRef.current) return;

        const container = containerRef.current;

        // Apply containment
        applyContainment(container, options);

        // Set up observer if requested
        let observer = null;
        if (autoObserve) {
            observer = createContainmentObserver(container, options);
        }

        // Cleanup function
        return () => {
            if (observer) {
                observer.disconnect();
            }
            removeContainment(container);
        };
    }, [enabled, containerRef, autoObserve]);
}

// Export default object with all utilities
export default {
    containFixedElements,
    restoreOriginalPositioning,
    applyContainment,
    removeContainment,
    createContainmentObserver,
    useLayoutContainment
}; 