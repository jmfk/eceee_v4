import React, { useState, useMemo } from 'react'
import ValidatedInput from '../validation/ValidatedInput'
import { Eye, EyeOff, Lock, Check, X } from 'lucide-react'

/**
 * PasswordInput Component
 * 
 * Password input field component with visibility toggle and strength indicator.
 * Includes validation for common password requirements.
 */
const PasswordInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    placeholder = 'Enter password',
    showStrengthIndicator = true,
    showRequirements = true,
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSymbols = false,
    ...props
}) => {
    const [showPassword, setShowPassword] = useState(false)

    // Password strength calculation
    const passwordStrength = useMemo(() => {
        if (!value) return { score: 0, label: '', color: 'gray' }

        let score = 0
        const checks = {
            length: value.length >= minLength,
            uppercase: requireUppercase ? /[A-Z]/.test(value) : true,
            lowercase: requireLowercase ? /[a-z]/.test(value) : true,
            numbers: requireNumbers ? /\d/.test(value) : true,
            symbols: requireSymbols ? /[!@#$%^&*(),.?":{}|<>]/.test(value) : true,
        }

        // Calculate score
        Object.values(checks).forEach(check => {
            if (check) score++
        })

        // Determine strength level
        if (score === 0) return { score: 0, label: '', color: 'gray', checks }
        if (score <= 2) return { score, label: 'Weak', color: 'red', checks }
        if (score <= 3) return { score, label: 'Fair', color: 'yellow', checks }
        if (score <= 4) return { score, label: 'Good', color: 'blue', checks }
        return { score, label: 'Strong', color: 'green', checks }
    }, [value, minLength, requireUppercase, requireLowercase, requireNumbers, requireSymbols])

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword)
    }

    const getStrengthBarColor = () => {
        switch (passwordStrength.color) {
            case 'red': return 'bg-red-500'
            case 'yellow': return 'bg-yellow-500'
            case 'blue': return 'bg-blue-500'
            case 'green': return 'bg-green-500'
            default: return 'bg-gray-300'
        }
    }

    const getStrengthTextColor = () => {
        switch (passwordStrength.color) {
            case 'red': return 'text-red-600'
            case 'yellow': return 'text-yellow-600'
            case 'blue': return 'text-blue-600'
            case 'green': return 'text-green-600'
            default: return 'text-gray-600'
        }
    }

    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-gray-400" />
                </div>

                <ValidatedInput
                    type={showPassword ? 'text' : 'password'}
                    value={value || ''}
                    onChange={onChange}
                    validation={validation}
                    isValidating={isValidating}
                    disabled={disabled}
                    placeholder={placeholder}
                    className="pl-10 pr-10"
                    {...props}
                />

                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        title={showPassword ? 'Hide password' : 'Show password'}
                    >
                        {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                        ) : (
                            <Eye className="h-4 w-4" />
                        )}
                    </button>
                </div>
            </div>

            {description && (
                <div className="text-sm text-gray-500">{description}</div>
            )}

            {/* Strength Indicator */}
            {showStrengthIndicator && value && (
                <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">Password strength:</span>
                        <span className={`text-xs font-medium ${getStrengthTextColor()}`}>
                            {passwordStrength.label}
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                            className={`h-1.5 rounded-full transition-all duration-300 ${getStrengthBarColor()}`}
                            style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Requirements */}
            {showRequirements && value && (
                <div className="mt-2 space-y-1">
                    <div className="text-xs text-gray-600 mb-1">Requirements:</div>
                    <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                            {passwordStrength.checks?.length ? (
                                <Check className="h-3 w-3 text-green-500" />
                            ) : (
                                <X className="h-3 w-3 text-red-500" />
                            )}
                            <span className={`text-xs ${passwordStrength.checks?.length ? 'text-green-600' : 'text-red-600'}`}>
                                At least {minLength} characters
                            </span>
                        </div>

                        {requireUppercase && (
                            <div className="flex items-center space-x-2">
                                {passwordStrength.checks?.uppercase ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                    <X className="h-3 w-3 text-red-500" />
                                )}
                                <span className={`text-xs ${passwordStrength.checks?.uppercase ? 'text-green-600' : 'text-red-600'}`}>
                                    One uppercase letter
                                </span>
                            </div>
                        )}

                        {requireLowercase && (
                            <div className="flex items-center space-x-2">
                                {passwordStrength.checks?.lowercase ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                    <X className="h-3 w-3 text-red-500" />
                                )}
                                <span className={`text-xs ${passwordStrength.checks?.lowercase ? 'text-green-600' : 'text-red-600'}`}>
                                    One lowercase letter
                                </span>
                            </div>
                        )}

                        {requireNumbers && (
                            <div className="flex items-center space-x-2">
                                {passwordStrength.checks?.numbers ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                    <X className="h-3 w-3 text-red-500" />
                                )}
                                <span className={`text-xs ${passwordStrength.checks?.numbers ? 'text-green-600' : 'text-red-600'}`}>
                                    One number
                                </span>
                            </div>
                        )}

                        {requireSymbols && (
                            <div className="flex items-center space-x-2">
                                {passwordStrength.checks?.symbols ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                    <X className="h-3 w-3 text-red-500" />
                                )}
                                <span className={`text-xs ${passwordStrength.checks?.symbols ? 'text-green-600' : 'text-red-600'}`}>
                                    One special character
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

PasswordInput.displayName = 'PasswordInput'

export default PasswordInput
