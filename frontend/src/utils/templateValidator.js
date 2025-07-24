/**
 * Template Validation Utilities
 * 
 * Provides utility functions for calling template validation APIs
 * with error handling, caching, and retry logic.
 */

import { apiClient } from '../api/client';

// Validation cache for performance
const validationCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Generate cache key for validation request
const generateCacheKey = (htmlContent, cssContent, options) => {
    const content = htmlContent + cssContent + JSON.stringify(options);
    return btoa(content).slice(0, 32); // Base64 encoded hash (truncated)
};

// Check if cached result is still valid
const isCacheValid = (cachedItem) => {
    return cachedItem && (Date.now() - cachedItem.timestamp) < CACHE_EXPIRY;
};

/**
 * Comprehensive template validation
 * @param {Object} params - Validation parameters
 * @param {string} params.htmlContent - HTML template content
 * @param {string} params.cssContent - CSS content
 * @param {string} params.templateName - Template name for logging
 * @param {Object} params.validationOptions - Validation options
 * @param {boolean} params.useCache - Whether to use cache
 * @returns {Promise<Object>} Validation result
 */
export const validateTemplate = async ({
    htmlContent,
    cssContent = '',
    templateName = 'template',
    validationOptions = {},
    useCache = true
}) => {
    // Default validation options
    const defaultOptions = {
        html_validation: true,
        css_validation: true,
        security_scan: true,
        performance_analysis: true,
        accessibility_check: true,
        slot_validation: true
    };

    const options = { ...defaultOptions, ...validationOptions };

    // Check cache first
    if (useCache) {
        const cacheKey = generateCacheKey(htmlContent, cssContent, options);
        const cachedResult = validationCache.get(cacheKey);

        if (isCacheValid(cachedResult)) {
            return { ...cachedResult.data, cached: true };
        }
    }

    try {
        const response = await apiClient.post('/webpages/layouts/validate-template/', {
            html_content: htmlContent,
            css_content: cssContent,
            template_name: templateName,
            validation_options: options
        });

        const result = response.data;

        // Cache the result
        if (useCache) {
            const cacheKey = generateCacheKey(htmlContent, cssContent, options);
            validationCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
        }

        return result;

    } catch (error) {
        console.error('Template validation failed:', error);

        // Return error result in consistent format
        return {
            is_valid: false,
            issues: [{
                type: 'system_error',
                severity: 'critical',
                message: error.response?.data?.error || 'Validation service unavailable',
                suggestion: 'Please check your connection and try again',
                context: error.message
            }],
            error_count: 1,
            warning_count: 0,
            critical_count: 1,
            validation_time_ms: 0,
            validated_at: new Date().toISOString(),
            error: true
        };
    }
};

/**
 * Quick template validation for real-time feedback
 * @param {Object} params - Validation parameters
 * @param {string} params.htmlContent - HTML template content
 * @param {string} params.cssContent - CSS content
 * @param {Array<string>} params.validationTypes - Types of validation to perform
 * @returns {Promise<Object>} Quick validation result
 */
export const quickValidateTemplate = async ({
    htmlContent,
    cssContent = '',
    validationTypes = ['html_syntax', 'css_syntax', 'security_basic']
}) => {
    try {
        const response = await apiClient.post('/webpages/layouts/quick-validate/', {
            html_content: htmlContent,
            css_content: cssContent,
            validation_types: validationTypes
        });

        return response.data;

    } catch (error) {
        console.error('Quick validation failed:', error);

        return {
            is_valid: false,
            error_count: 1,
            warning_count: 0,
            critical_count: 1,
            issues: [{
                type: 'system_error',
                severity: 'critical',
                message: 'Quick validation unavailable'
            }],
            validation_time_ms: 0,
            timestamp: new Date().toISOString(),
            error: true
        };
    }
};

/**
 * Security scan for templates
 * @param {Object} params - Scan parameters
 * @param {string} params.htmlContent - HTML template content
 * @param {string} params.cssContent - CSS content
 * @param {Object} params.scanOptions - Security scan options
 * @returns {Promise<Object>} Security scan result
 */
export const securityScanTemplate = async ({
    htmlContent,
    cssContent = '',
    scanOptions = {}
}) => {
    const defaultScanOptions = {
        xss_scan: true,
        sql_injection_scan: true,
        csp_validation: true
    };

    const options = { ...defaultScanOptions, ...scanOptions };

    try {
        const response = await apiClient.post('/webpages/layouts/security-scan/', {
            html_content: htmlContent,
            css_content: cssContent,
            scan_options: options
        });

        return response.data;

    } catch (error) {
        console.error('Security scan failed:', error);

        return {
            security_findings: [],
            security_metrics: {
                total_findings: 0,
                severity_counts: { critical: 0, high: 0, medium: 0, low: 0 },
                category_counts: {},
                security_score: 0,
                risk_level: 'UNKNOWN'
            },
            is_secure: false,
            scan_timestamp: new Date().toISOString(),
            error: true
        };
    }
};

/**
 * Performance analysis for templates
 * @param {Object} params - Analysis parameters
 * @param {string} params.htmlContent - HTML template content
 * @param {string} params.cssContent - CSS content
 * @param {string} params.templateName - Template name
 * @returns {Promise<Object>} Performance analysis result
 */
export const analyzeTemplatePerformance = async ({
    htmlContent,
    cssContent = '',
    templateName = 'template'
}) => {
    try {
        const response = await apiClient.post('/webpages/layouts/performance-analysis/', {
            html_content: htmlContent,
            css_content: cssContent,
            template_name: templateName
        });

        return response.data;

    } catch (error) {
        console.error('Performance analysis failed:', error);

        return {
            performance_metrics: {
                parse_time_ms: 0,
                dom_nodes: 0,
                css_rules: 0,
                slot_count: 0,
                template_size_bytes: 0,
                complexity_score: 0,
                estimated_render_time_ms: 0
            },
            recommendations: [],
            performance_grade: 'F',
            analysis_timestamp: new Date().toISOString(),
            error: true
        };
    }
};

/**
 * Accessibility check for templates
 * @param {Object} params - Check parameters
 * @param {string} params.htmlContent - HTML template content
 * @param {string} params.templateName - Template name
 * @returns {Promise<Object>} Accessibility check result
 */
export const checkTemplateAccessibility = async ({
    htmlContent,
    templateName = 'template'
}) => {
    try {
        const response = await apiClient.post('/webpages/layouts/accessibility-check/', {
            html_content: htmlContent,
            template_name: templateName
        });

        return response.data;

    } catch (error) {
        console.error('Accessibility check failed:', error);

        return {
            accessibility_score: 0,
            accessibility_grade: 'F',
            issues: [],
            recommendations: [],
            compliance_level: 'Non-compliant',
            check_timestamp: new Date().toISOString(),
            error: true
        };
    }
};

/**
 * Comprehensive template analysis combining all validation types
 * @param {Object} params - Analysis parameters
 * @returns {Promise<Object>} Complete analysis result
 */
export const analyzeTemplate = async (params) => {
    const {
        htmlContent,
        cssContent = '',
        templateName = 'template',
        includePerformance = true,
        includeSecurity = true,
        includeAccessibility = true
    } = params;

    try {
        // Run comprehensive validation first
        const validationPromise = validateTemplate({
            htmlContent,
            cssContent,
            templateName,
            validationOptions: {
                html_validation: true,
                css_validation: true,
                security_scan: includeSecurity,
                performance_analysis: includePerformance,
                accessibility_check: includeAccessibility,
                slot_validation: true
            }
        });

        // Run additional analyses in parallel if requested
        const promises = [validationPromise];

        if (includeSecurity) {
            promises.push(securityScanTemplate({ htmlContent, cssContent }));
        }

        if (includePerformance) {
            promises.push(analyzeTemplatePerformance({ htmlContent, cssContent, templateName }));
        }

        if (includeAccessibility) {
            promises.push(checkTemplateAccessibility({ htmlContent, templateName }));
        }

        const results = await Promise.allSettled(promises);

        // Extract results
        const validation = results[0].status === 'fulfilled' ? results[0].value : null;
        const security = includeSecurity && results[1]?.status === 'fulfilled' ? results[1].value : null;
        const performance = includePerformance && results[2]?.status === 'fulfilled' ? results[2].value : null;
        const accessibility = includeAccessibility && results[3]?.status === 'fulfilled' ? results[3].value : null;

        return {
            validation,
            security,
            performance,
            accessibility,
            timestamp: new Date().toISOString(),
            template_name: templateName
        };

    } catch (error) {
        console.error('Template analysis failed:', error);
        throw error;
    }
};

/**
 * Clear validation cache
 */
export const clearValidationCache = () => {
    validationCache.clear();
};

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export const getCacheStats = () => {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, value] of validationCache.entries()) {
        if (isCacheValid(value)) {
            validEntries++;
        } else {
            expiredEntries++;
        }
    }

    return {
        totalEntries: validationCache.size,
        validEntries,
        expiredEntries,
        cacheHitRate: validEntries / Math.max(validationCache.size, 1)
    };
};

/**
 * Validation severity levels
 */
export const VALIDATION_SEVERITY = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

/**
 * Validation types
 */
export const VALIDATION_TYPES = {
    HTML_SYNTAX: 'html_syntax',
    HTML_STRUCTURE: 'html_structure',
    CSS_SYNTAX: 'css_syntax',
    CSS_SECURITY: 'css_security',
    SLOT_CONFIGURATION: 'slot_configuration',
    SECURITY_SCAN: 'security_scan',
    PERFORMANCE: 'performance',
    ACCESSIBILITY: 'accessibility'
};

/**
 * Security threat levels
 */
export const SECURITY_THREAT_LEVELS = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * Performance grades
 */
export const PERFORMANCE_GRADES = {
    A_PLUS: 'A+',
    A: 'A',
    B_PLUS: 'B+',
    B: 'B',
    C_PLUS: 'C+',
    C: 'C',
    D_PLUS: 'D+',
    D: 'D',
    F: 'F'
};

/**
 * Accessibility compliance levels
 */
export const ACCESSIBILITY_LEVELS = {
    WCAG_AAA: 'WCAG AAA',
    WCAG_AA: 'WCAG AA',
    WCAG_A: 'WCAG A',
    NON_COMPLIANT: 'Non-compliant'
};

// Export default object with all functions
export default {
    validateTemplate,
    quickValidateTemplate,
    securityScanTemplate,
    analyzeTemplatePerformance,
    checkTemplateAccessibility,
    analyzeTemplate,
    clearValidationCache,
    getCacheStats,
    VALIDATION_SEVERITY,
    VALIDATION_TYPES,
    SECURITY_THREAT_LEVELS,
    PERFORMANCE_GRADES,
    ACCESSIBILITY_LEVELS
}; 