/**
 * Path Validation Utility
 * 
 * Client-side validation for path inputs to provide defense-in-depth security.
 * This complements backend validation but does NOT replace it.
 * 
 * Security Note: Backend validation remains the authoritative security boundary.
 * These checks help catch obviously malicious input early and improve UX.
 */

/**
 * Dangerous patterns that could indicate XSS or injection attempts
 */
const DANGEROUS_PATTERNS = [
    /<script/i,
    /javascript:/i,
    /data:text\/html/i,
    /on\w+\s*=/i,  // Event handlers like onclick=
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<img/i,
    /<svg/i,
    /vbscript:/i,
    /%3Cscript/i,  // URL-encoded <script
    /&#/i,  // HTML entities that could be used for obfuscation
];

/**
 * Maximum allowed path length
 */
const MAX_PATH_LENGTH = 500;

/**
 * Sanitize a path by trimming whitespace and normalizing slashes
 * @param {string} path - The path to sanitize
 * @returns {string} Sanitized path
 */
export const sanitizePath = (path) => {
    if (typeof path !== 'string') {
        return '';
    }

    // Trim whitespace
    let sanitized = path.trim();

    // Normalize multiple slashes to single slash
    sanitized = sanitized.replace(/\/+/g, '/');

    // Remove leading slash if present (paths should be relative)
    if (sanitized.startsWith('/')) {
        sanitized = sanitized.substring(1);
    }

    return sanitized;
};

/**
 * Detect potentially malicious patterns in a path
 * @param {string} path - The path to check
 * @returns {{detected: boolean, pattern?: string}} Detection result
 */
export const detectMaliciousPatterns = (path) => {
    if (typeof path !== 'string') {
        return { detected: false };
    }

    // Check for null bytes
    if (path.includes('\0')) {
        return {
            detected: true,
            pattern: 'null byte'
        };
    }

    // Check against known dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(path)) {
            return {
                detected: true,
                pattern: pattern.toString()
            };
        }
    }

    return { detected: false };
};

/**
 * Validate basic path format
 * @param {string} path - The path to validate
 * @returns {{valid: boolean, reason?: string}} Validation result
 */
export const validatePathFormat = (path) => {
    if (typeof path !== 'string') {
        return {
            valid: false,
            reason: 'Path must be a string'
        };
    }

    // Check length
    if (path.length === 0) {
        return {
            valid: false,
            reason: 'Path cannot be empty'
        };
    }

    if (path.length > MAX_PATH_LENGTH) {
        return {
            valid: false,
            reason: `Path exceeds maximum length of ${MAX_PATH_LENGTH} characters`
        };
    }

    // Check for null bytes
    if (path.includes('\0')) {
        return {
            valid: false,
            reason: 'Path contains null bytes'
        };
    }

    // Warn about unusual characters (but don't block - backend will validate)
    // Most path patterns expect alphanumeric, hyphens, underscores, and slashes
    const hasUnusualChars = /[^a-zA-Z0-9\-_\/.]/.test(path);
    if (hasUnusualChars) {
        // This is just a warning - we'll let it through
        console.debug('Path contains unusual characters:', path);
    }

    return { valid: true };
};

/**
 * Main validation function - checks if a path is safe to send to backend
 * @param {string} path - The path to validate
 * @returns {{safe: boolean, reason?: string, sanitized?: string}} Validation result
 */
export const isPathSafe = (path) => {
    // Basic format validation
    const formatCheck = validatePathFormat(path);
    if (!formatCheck.valid) {
        return {
            safe: false,
            reason: formatCheck.reason
        };
    }

    // Check for malicious patterns
    const maliciousCheck = detectMaliciousPatterns(path);
    if (maliciousCheck.detected) {
        return {
            safe: false,
            reason: `Potentially malicious pattern detected: ${maliciousCheck.pattern}`
        };
    }

    return {
        safe: true,
        sanitized: path
    };
};

/**
 * Validate and sanitize a path in one call
 * @param {string} path - The path to process
 * @returns {{safe: boolean, sanitized?: string, reason?: string}} Result with sanitized path
 */
export const validateAndSanitizePath = (path) => {
    // First sanitize
    const sanitized = sanitizePath(path);

    // Then validate the sanitized version
    const validation = isPathSafe(sanitized);

    if (!validation.safe) {
        return validation;
    }

    return {
        safe: true,
        sanitized: sanitized
    };
};

