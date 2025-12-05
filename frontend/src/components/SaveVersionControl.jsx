import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Save, CheckCircle, FileText, Clock, AlertCircle, Plus } from 'lucide-react'

const SaveVersionControl = ({
    currentVersion,
    availableVersions = [],
    onVersionChange,
    onSaveClick,
    onSaveNewClick,
    isSaving = false,
    isNewPage = false,
    validationState = { isValid: true, hasErrors: false },
    isDirty = false,
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Helper function to find the currently active published version
    const getCurrentlyPublishedVersion = () => {
        const now = new Date();

        const publishedVersions = availableVersions
            .filter(version => {
                const effectiveDate = version.effectiveDate ? new Date(version.effectiveDate) : null;
                const expiryDate = version.expiryDate ? new Date(version.expiryDate) : null;

                if (!effectiveDate || effectiveDate > now) return false;
                if (expiryDate && expiryDate <= now) return false;

                return true;
            })
            .sort((a, b) => b.versionNumber - a.versionNumber);

        return publishedVersions.length > 0 ? publishedVersions[0] : null;
    }

    // Determine version status with proper icons and colors (reused from VersionSelector)
    const getVersionStatus = (version) => {
        const now = new Date();
        const effectiveDate = version.effectiveDate ? new Date(version.effectiveDate) : null;
        const expiryDate = version.expiryDate ? new Date(version.expiryDate) : null;

        const currentlyPublished = getCurrentlyPublishedVersion();
        if (currentlyPublished && currentlyPublished.id === version.id) {
            return {
                icon: CheckCircle,
                color: 'text-green-600',
                bgColor: 'bg-green-50',
                label: 'Published'
            }
        }

        if (effectiveDate && effectiveDate > now) {
            return {
                icon: Clock,
                color: 'text-blue-600',
                bgColor: 'bg-blue-50',
                label: 'Scheduled'
            }
        }

        if (expiryDate && expiryDate <= now) {
            return {
                icon: AlertCircle,
                color: 'text-red-600',
                bgColor: 'bg-red-50',
                label: 'Expired'
            }
        }

        if (effectiveDate && effectiveDate <= now && currentlyPublished && currentlyPublished.id !== version.id) {
            return {
                icon: AlertCircle,
                color: 'text-orange-600',
                bgColor: 'bg-orange-50',
                label: 'Superseded'
            }
        }

        return {
            icon: FileText,
            color: 'text-gray-600',
            bgColor: 'bg-gray-50',
            label: 'Draft'
        }
    }

    const handleVersionSelect = (versionId) => {
        setIsOpen(false)
        if (onVersionChange) {
            const numericId = parseInt(versionId)
            onVersionChange(numericId)
        }
    }

    const handleSaveNew = () => {
        setIsOpen(false)
        if (onSaveNewClick) {
            onSaveNewClick()
        }
    }

    // Don't render if not dirty
    if (!isDirty) {
        return null
    }

    // Simple save button for new pages (no dropdown)
    if (isNewPage) {
        return (
            <button
                onClick={onSaveClick}
                disabled={isSaving}
                className="font-medium px-3 py-1 text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 rounded transition-colors flex items-center space-x-1"
                title="Create new page"
            >
                {isSaving ? (
                    <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span className="text-xs">Creating...</span>
                    </>
                ) : (
                    <>
                        <Save className="w-3 h-3" />
                        <span className="text-xs">Save</span>
                    </>
                )}
            </button>
        )
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Split button */}
            <div className="flex items-center">
                {/* Main save button */}
                <button
                    onClick={onSaveClick}
                    disabled={isSaving}
                    className="font-medium px-3 py-1 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-l transition-colors flex items-center space-x-1"
                    title={validationState.hasErrors ? "Save changes (validation errors will be handled)" : "Update current version"}
                >
                    {isSaving ? (
                        <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            <span className="text-xs">Saving...</span>
                        </>
                    ) : (
                        <>
                            <Save className="w-3 h-3" />
                            <span className="text-xs">
                                Save {currentVersion ? `v${currentVersion.versionNumber}` : ''}
                            </span>
                        </>
                    )}
                </button>

                {/* Dropdown button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={isSaving}
                    className="font-medium px-2 py-1 text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-r border-l border-blue-800 transition-colors flex items-center justify-center"
                    title="More save options"
                >
                    <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
                </button>
            </div>

            {/* Dropdown menu */}
            {isOpen && (
                <div className="absolute bottom-full right-0 mb-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto w-max min-w-48">
                    {/* Save New Version option */}
                    <button
                        onClick={handleSaveNew}
                        disabled={isSaving}
                        className="w-full px-3 py-2 text-left hover:bg-green-50 focus:outline-none focus:bg-green-50 border-b border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="flex items-center space-x-3">
                            <Plus className="w-4 h-4 flex-shrink-0 text-green-600" />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-gray-900">
                                    Save New Version
                                </div>
                                <div className="text-xs text-gray-500">
                                    Create a new version
                                </div>
                            </div>
                        </div>
                    </button>

                    {/* Divider with label */}
                    {availableVersions.length > 0 && (
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Switch to Version
                            </div>
                        </div>
                    )}

                    {/* Version list */}
                    {availableVersions.map((version) => {
                        const status = getVersionStatus(version)
                        const StatusIcon = status.icon
                        const isSelected = currentVersion?.id === version.id

                        return (
                            <button
                                key={version.id}
                                onClick={() => handleVersionSelect(version.id)}
                                disabled={isSelected}
                                className={`w-full px-3 py-2 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 border-b border-gray-100 last:border-b-0 disabled:cursor-not-allowed ${
                                    isSelected ? status.bgColor : ''
                                }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <StatusIcon className={`w-4 h-4 flex-shrink-0 ${status.color}`} />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium text-gray-900 truncate">
                                            {version.description || `Version ${version.versionNumber}`}
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center space-x-1">
                                            <span>v{version.versionNumber}</span>
                                            <span>•</span>
                                            <span className={status.color}>{status.label}</span>
                                            {isSelected && (
                                                <>
                                                    <span>•</span>
                                                    <span className="font-medium">Current</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default SaveVersionControl

