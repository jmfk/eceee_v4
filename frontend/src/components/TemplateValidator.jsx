/**
 * Comprehensive Template Validation Component
 * 
 * Provides real-time template validation with security scanning,
 * performance analysis, and accessibility checking.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { debounce } from 'lodash';

// Validation severity levels
const VALIDATION_SEVERITY = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

// Validation types
const VALIDATION_TYPES = {
    HTML_SYNTAX: 'html_syntax',
    HTML_STRUCTURE: 'html_structure',
    CSS_SYNTAX: 'css_syntax',
    CSS_SECURITY: 'css_security',
    SLOT_CONFIGURATION: 'slot_configuration',
    SECURITY_SCAN: 'security_scan',
    PERFORMANCE: 'performance',
    ACCESSIBILITY: 'accessibility'
};

// Icon components for different severities
const SeverityIcon = ({ severity }) => {
    const iconClasses = {
        [VALIDATION_SEVERITY.INFO]: 'text-blue-500',
        [VALIDATION_SEVERITY.WARNING]: 'text-yellow-500',
        [VALIDATION_SEVERITY.ERROR]: 'text-red-500',
        [VALIDATION_SEVERITY.CRITICAL]: 'text-red-700'
    };

    const icons = {
        [VALIDATION_SEVERITY.INFO]: '🛈',
        [VALIDATION_SEVERITY.WARNING]: '⚠️',
        [VALIDATION_SEVERITY.ERROR]: '❌',
        [VALIDATION_SEVERITY.CRITICAL]: '🚨'
    };

    return (
        <span className={`inline-flex items-center justify-center w-5 h-5 text-sm ${iconClasses[severity]}`}>
            {icons[severity]}
        </span>
    );
};

// Security risk indicator
const SecurityRiskIndicator = ({ riskLevel, score }) => {
    const getRiskColor = (level) => {
        switch (level) {
            case 'MINIMAL': return 'bg-green-100 text-green-800 border-green-200';
            case 'LOW': return 'bg-green-100 text-green-700 border-green-200';
            case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(riskLevel)}`}>
            <span className="mr-1">🔒</span>
            <span>{riskLevel}</span>
            {score !== undefined && (
                <span className="ml-1">({score}/100)</span>
            )}
        </div>
    );
};

// Performance grade indicator
const PerformanceGrade = ({ grade, score }) => {
    const getGradeColor = (grade) => {
        switch (grade) {
            case 'A+':
            case 'A': return 'bg-green-100 text-green-800 border-green-200';
            case 'B+':
            case 'B': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'C+':
            case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'D+':
            case 'D': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'F': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getGradeColor(grade)}`}>
            <span className="mr-1">⚡</span>
            <span>{grade}</span>
            {score !== undefined && (
                <span className="ml-1">({score.toFixed(1)})</span>
            )}
        </div>
    );
};

// Accessibility score indicator
const AccessibilityScore = ({ score, grade }) => {
    const getScoreColor = (score) => {
        if (score >= 90) return 'bg-green-100 text-green-800 border-green-200';
        if (score >= 75) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        if (score >= 60) return 'bg-orange-100 text-orange-800 border-orange-200';
        return 'bg-red-100 text-red-800 border-red-200';
    };

    return (
        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getScoreColor(score)}`}>
            <span className="mr-1">♿</span>
            <span>{grade}</span>
            <span className="ml-1">({score.toFixed(1)}/100)</span>
        </div>
    );
};

// Validation issue item component
const ValidationIssue = ({ issue, index }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="border border-gray-200 rounded-lg p-3 mb-2 hover:shadow-sm transition-shadow">
            <div
                className="flex items-start space-x-3 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <SeverityIcon severity={issue.severity} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                            {issue.message}
                        </p>
                        <span className="text-xs text-gray-500 ml-2">
                            {issue.type}
                        </span>
                    </div>

                    {issue.element && (
                        <p className="text-xs text-gray-600 mt-1">
                            Element: <code className="bg-gray-100 px-1 rounded">{issue.element}</code>
                        </p>
                    )}

                    {issue.line_number && (
                        <p className="text-xs text-gray-600 mt-1">
                            Line: {issue.line_number}
                            {issue.column_number && `, Column: ${issue.column_number}`}
                        </p>
                    )}
                </div>

                <button className="text-gray-400 hover:text-gray-600">
                    {expanded ? '▲' : '▼'}
                </button>
            </div>

            {expanded && (
                <div className="mt-3 pl-8 space-y-2">
                    {issue.context && (
                        <div>
                            <p className="text-xs font-medium text-gray-700">Context:</p>
                            <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-x-auto">
                                {issue.context}
                            </pre>
                        </div>
                    )}

                    {issue.suggestion && (
                        <div>
                            <p className="text-xs font-medium text-gray-700">Suggestion:</p>
                            <p className="text-xs text-gray-600">{issue.suggestion}</p>
                        </div>
                    )}

                    {issue.rule_id && (
                        <p className="text-xs text-gray-500">Rule: {issue.rule_id}</p>
                    )}
                </div>
            )}
        </div>
    );
};

// Summary stats component
const ValidationSummary = ({ validationResult }) => {
    if (!validationResult) return null;

    const {
        is_valid,
        error_count = 0,
        warning_count = 0,
        critical_count = 0,
        accessibility_score,
        security_score,
        performance_metrics
    } = validationResult;

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Validation Summary</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                    <div className={`text-2xl font-bold ${is_valid ? 'text-green-600' : 'text-red-600'}`}>
                        {is_valid ? '✓' : '✗'}
                    </div>
                    <div className="text-sm text-gray-600">
                        {is_valid ? 'Valid' : 'Invalid'}
                    </div>
                </div>

                <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                        {critical_count + error_count}
                    </div>
                    <div className="text-sm text-gray-600">Errors</div>
                </div>

                <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                        {warning_count}
                    </div>
                    <div className="text-sm text-gray-600">Warnings</div>
                </div>

                <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">
                        {validationResult.validation_time_ms?.toFixed(1) || 0}ms
                    </div>
                    <div className="text-sm text-gray-600">Validation Time</div>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {security_score !== undefined && (
                    <SecurityRiskIndicator
                        riskLevel={security_score >= 80 ? 'LOW' : security_score >= 60 ? 'MEDIUM' : 'HIGH'}
                        score={security_score}
                    />
                )}

                {accessibility_score !== undefined && (
                    <AccessibilityScore
                        score={accessibility_score}
                        grade={accessibility_score >= 90 ? 'A' : accessibility_score >= 80 ? 'B' : accessibility_score >= 70 ? 'C' : 'D'}
                    />
                )}

                {performance_metrics && (
                    <PerformanceGrade
                        grade={performance_metrics.complexity_score < 30 ? 'A' : performance_metrics.complexity_score < 50 ? 'B' : performance_metrics.complexity_score < 70 ? 'C' : 'D'}
                        score={100 - performance_metrics.complexity_score}
                    />
                )}
            </div>
        </div>
    );
};

// Main template validator component
const TemplateValidator = ({
    htmlContent = '',
    cssContent = '',
    templateName = 'template',
    onValidationResult = () => { },
    realTimeValidation = true,
    validationDelay = 1000,
    className = ''
}) => {
    const [validationResult, setValidationResult] = useState(null);
    const [isValidating, setIsValidating] = useState(false);
    const [securityFindings, setSecurityFindings] = useState([]);
    const [validationOptions, setValidationOptions] = useState({
        html_validation: true,
        css_validation: true,
        security_scan: true,
        performance_analysis: true,
        accessibility_check: true,
        slot_validation: true
    });
    const [activeTab, setActiveTab] = useState('issues');

    // API call function
    const performValidation = useCallback(async (html, css, options = {}) => {
        if (!html.trim()) {
            setValidationResult(null);
            return;
        }

        setIsValidating(true);

        try {
            const response = await fetch('/api/v1/webpages/layouts/validate-template/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]')?.value || ''
                },
                body: JSON.stringify({
                    html_content: html,
                    css_content: css,
                    template_name: templateName,
                    validation_options: { ...validationOptions, ...options }
                })
            });

            const result = await response.json();
            setValidationResult(result);
            onValidationResult(result);

            // Also get security findings if security scan is enabled
            if (validationOptions.security_scan && html.trim()) {
                try {
                    const securityResponse = await fetch('/api/v1/webpages/layouts/security-scan/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]')?.value || ''
                        },
                        body: JSON.stringify({
                            html_content: html,
                            css_content: css,
                            scan_options: {
                                xss_scan: true,
                                sql_injection_scan: true,
                                csp_validation: true
                            }
                        })
                    });

                    const securityResult = await securityResponse.json();
                    setSecurityFindings(securityResult.security_findings || []);
                } catch (securityError) {
                    console.error('Security scan failed:', securityError);
                }
            }

        } catch (error) {
            console.error('Validation failed:', error);
            setValidationResult({
                is_valid: false,
                issues: [{
                    type: 'system_error',
                    severity: 'critical',
                    message: 'Validation service unavailable',
                    suggestion: 'Please try again later'
                }],
                error_count: 1,
                warning_count: 0,
                critical_count: 1
            });
        } finally {
            setIsValidating(false);
        }
    }, [templateName, validationOptions, onValidationResult]);

    // Debounced validation for real-time feedback
    const debouncedValidation = useMemo(
        () => debounce(performValidation, validationDelay),
        [performValidation, validationDelay]
    );

    // Effect for real-time validation
    useEffect(() => {
        if (realTimeValidation && (htmlContent || cssContent)) {
            debouncedValidation(htmlContent, cssContent);
        }

        return () => {
            debouncedValidation.cancel();
        };
    }, [htmlContent, cssContent, debouncedValidation, realTimeValidation]);

    // Quick validation for immediate feedback
    const performQuickValidation = useCallback(async () => {
        if (!htmlContent.trim()) return;

        setIsValidating(true);

        try {
            const response = await fetch('/api/v1/webpages/layouts/quick-validate/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]')?.value || ''
                },
                body: JSON.stringify({
                    html_content: htmlContent,
                    css_content: cssContent,
                    validation_types: ['html_syntax', 'css_syntax', 'security_basic']
                })
            });

            const result = await response.json();
            setValidationResult(result);
            onValidationResult(result);

        } catch (error) {
            console.error('Quick validation failed:', error);
        } finally {
            setIsValidating(false);
        }
    }, [htmlContent, cssContent, onValidationResult]);

    // Manual validation trigger
    const handleManualValidation = () => {
        performValidation(htmlContent, cssContent);
    };

    // Filter issues by type
    const getIssuesByType = (type) => {
        if (!validationResult?.issues) return [];
        return validationResult.issues.filter(issue => issue.type === type);
    };

    const allIssues = validationResult?.issues || [];
    const errorIssues = allIssues.filter(issue =>
        issue.severity === VALIDATION_SEVERITY.ERROR ||
        issue.severity === VALIDATION_SEVERITY.CRITICAL
    );
    const warningIssues = allIssues.filter(issue =>
        issue.severity === VALIDATION_SEVERITY.WARNING
    );
    const infoIssues = allIssues.filter(issue =>
        issue.severity === VALIDATION_SEVERITY.INFO
    );

    return (
        <div className={`bg-gray-50 rounded-lg border border-gray-200 ${className}`}>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 rounded-t-lg">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Template Validator</h2>

                    <div className="flex items-center space-x-2">
                        {isValidating && (
                            <div className="flex items-center text-sm text-gray-600">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                Validating...
                            </div>
                        )}

                        <button
                            onClick={handleManualValidation}
                            disabled={isValidating || !htmlContent.trim()}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Validate
                        </button>

                        <button
                            onClick={performQuickValidation}
                            disabled={isValidating || !htmlContent.trim()}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Quick Check
                        </button>
                    </div>
                </div>

                {/* Validation options */}
                <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(validationOptions).map(([key, enabled]) => (
                        <label key={key} className="flex items-center space-x-1 text-sm">
                            <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(e) => setValidationOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-gray-700 capitalize">
                                {key.replace(/_/g, ' ')}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {/* Summary */}
                <ValidationSummary validationResult={validationResult} />

                {/* Tabs */}
                <div className="border-b border-gray-200 mb-4">
                    <nav className="-mb-px flex space-x-8">
                        {[
                            { id: 'issues', label: 'Issues', count: allIssues.length },
                            { id: 'security', label: 'Security', count: securityFindings.length },
                            { id: 'errors', label: 'Errors', count: errorIssues.length },
                            { id: 'warnings', label: 'Warnings', count: warningIssues.length }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${activeTab === tab.id
                                            ? 'bg-blue-100 text-blue-600'
                                            : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab content */}
                <div className="space-y-3">
                    {activeTab === 'issues' && (
                        <div>
                            {allIssues.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    {validationResult ? 'No issues found! ✨' : 'Enter template content to validate'}
                                </div>
                            ) : (
                                allIssues.map((issue, index) => (
                                    <ValidationIssue key={index} issue={issue} index={index} />
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div>
                            {securityFindings.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    {validationResult ? 'No security issues found! 🔒' : 'Run security scan to see results'}
                                </div>
                            ) : (
                                securityFindings.map((finding, index) => (
                                    <ValidationIssue key={index} issue={finding} index={index} />
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'errors' && (
                        <div>
                            {errorIssues.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    No errors found! ✅
                                </div>
                            ) : (
                                errorIssues.map((issue, index) => (
                                    <ValidationIssue key={index} issue={issue} index={index} />
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'warnings' && (
                        <div>
                            {warningIssues.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    No warnings found! ✨
                                </div>
                            ) : (
                                warningIssues.map((issue, index) => (
                                    <ValidationIssue key={index} issue={issue} index={index} />
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TemplateValidator; 