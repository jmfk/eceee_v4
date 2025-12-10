import React, { useState } from 'react'
import { User, Search, X, AlertCircle } from 'lucide-react'

/**
 * UserSelectorInput Component
 * 
 * User selection component for selecting users from the system.
 * Currently a placeholder implementation until proper user API integration.
 */
const UserSelectorInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    multiple = false,
    searchable = true,
    placeholder,
    ...props
}) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [isSearching, setIsSearching] = useState(false)

    // Mock users data - replace with actual API call
    const mockUsers = [
        { id: 1, name: 'John Doe', email: 'john@example.com', avatar: null },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', avatar: null },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com', avatar: null },
    ]

    // Get validation status for styling
    const getValidationStatus = () => {
        if (isValidating) return 'validating'
        if (!validation) return 'none'
        if (validation.errors?.length > 0) return 'error'
        if (validation.warnings?.length > 0) return 'warning'
        return 'valid'
    }

    const validationStatus = getValidationStatus()
    const hasError = validationStatus === 'error'
    const hasWarning = validationStatus === 'warning'

    const handleUserSelect = (user) => {
        if (multiple) {
            const currentUsers = Array.isArray(value) ? value : []
            const isAlreadySelected = currentUsers.some(u => u.id === user.id)

            if (isAlreadySelected) {
                onChange(currentUsers.filter(u => u.id !== user.id))
            } else {
                onChange([...currentUsers, user])
            }
        } else {
            onChange(user)
        }
        setSearchTerm('')
    }

    const handleRemoveUser = (userId) => {
        if (multiple) {
            const currentUsers = Array.isArray(value) ? value : []
            onChange(currentUsers.filter(u => u.id !== userId))
        } else {
            onChange(null)
        }
    }

    const selectedUsers = multiple ? (Array.isArray(value) ? value : []) : (value ? [value] : [])
    const filteredUsers = mockUsers.filter(user =>
        !selectedUsers.some(selected => selected.id === user.id) &&
        (user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    return (
        <div className="space-y-2">
            {/* Label */}
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {/* Description */}
            {description && (
                <div className="text-sm text-gray-500">{description}</div>
            )}

            {/* TODO Implementation Notice */}
            <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-md flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-blue-700">
                    User selector using mock data - needs API integration
                </span>
            </div>

            {/* Selected Users */}
            {selectedUsers.length > 0 && (
                <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700">
                        Selected User{selectedUsers.length > 1 ? 's' : ''}:
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {selectedUsers.map(user => (
                            <div key={user.id} className="flex items-center space-x-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                                <User className="w-4 h-4" />
                                <span>{user.name}</span>
                                {!disabled && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveUser(user.id)}
                                        className="text-blue-600 hover:text-blue-800"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Search Input */}
            {searchable && !disabled && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={placeholder || 'Search users...'}
                        className={`
                            w-full pl-10 pr-4 py-2 border rounded-md
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                            ${hasError ? 'border-red-300 bg-red-50' :
                                hasWarning ? 'border-yellow-300 bg-yellow-50' :
                                    'border-gray-300 bg-white'}
                        `}
                    />
                </div>
            )}

            {/* User Options */}
            {searchTerm && filteredUsers.length > 0 && (
                <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                    {filteredUsers.map(user => (
                        <button
                            key={user.id}
                            type="button"
                            onClick={() => handleUserSelect(user)}
                            className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 text-left"
                        >
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-gray-600" />
                            </div>
                            <div className="flex-1">
                                <div className="font-medium text-gray-900">{user.name}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {searchTerm && filteredUsers.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                    No users found matching "{searchTerm}"
                </div>
            )}

            {/* Validation Messages */}
            {hasError && validation.errors?.map((error, index) => (
                <div key={index} className="text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                </div>
            ))}

            {hasWarning && validation.warnings?.map((warning, index) => (
                <div key={index} className="text-sm text-yellow-600 flex items-center space-x-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{warning}</span>
                </div>
            ))}

            {/* Loading State */}
            {isValidating && (
                <div className="text-sm text-blue-600">Validating...</div>
            )}
        </div>
    )
}

UserSelectorInput.displayName = 'UserSelectorInput'

export default UserSelectorInput
