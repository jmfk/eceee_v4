import { useState, useRef, useEffect } from 'react'
import { ChevronDown, CheckCircle, FileText, Clock, AlertCircle } from 'lucide-react'

const VersionSelector = ({
    currentVersion,
    availableVersions = [],
    onVersionChange,
    className = ""
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

    // Helper function to find the currently active published version (same logic as VersionTimelinePage)
    const getCurrentlyPublishedVersion = () => {
        const now = new Date();

        // Find the latest version (by version_number) that is currently published
        const publishedVersions = availableVersions
            .filter(version => {
                const effectiveDate = version.effective_date ? new Date(version.effective_date) : null;
                const expiryDate = version.expiry_date ? new Date(version.expiry_date) : null;

                // Must have effective date and be active
                if (!effectiveDate || effectiveDate > now) return false;

                // Must not be expired
                if (expiryDate && expiryDate <= now) return false;

                return true;
            })
            .sort((a, b) => b.version_number - a.version_number); // Sort by version number descending

        // Return the latest version (highest version_number) that's currently published
        return publishedVersions.length > 0 ? publishedVersions[0] : null;
    }

    // Determine version status with proper icons and colors
    const getVersionStatus = (version) => {
        const now = new Date();
        const effectiveDate = version.effective_date ? new Date(version.effective_date) : null;
        const expiryDate = version.expiry_date ? new Date(version.expiry_date) : null;

        // Check if this is the currently published version
        const currentlyPublished = getCurrentlyPublishedVersion();
        if (currentlyPublished && currentlyPublished.id === version.id) {
            return {
                icon: CheckCircle,
                color: 'text-green-600',
                bgColor: 'bg-green-50',
                label: 'Published'
            }
        }

        // Check for scheduled versions
        if (effectiveDate && effectiveDate > now) {
            return {
                icon: Clock,
                color: 'text-blue-600',
                bgColor: 'bg-blue-50',
                label: 'Scheduled'
            }
        }

        // Check for expired versions
        if (expiryDate && expiryDate <= now) {
            return {
                icon: AlertCircle,
                color: 'text-red-600',
                bgColor: 'bg-red-50',
                label: 'Expired'
            }
        }

        // Check for superseded versions (has effective_date but another version is currently published)
        if (effectiveDate && effectiveDate <= now && currentlyPublished && currentlyPublished.id !== version.id) {
            return {
                icon: AlertCircle,
                color: 'text-orange-600',
                bgColor: 'bg-orange-50',
                label: 'Superseded'
            }
        }

        // Default to draft
        return {
            icon: FileText,
            color: 'text-gray-600',
            bgColor: 'bg-gray-50',
            label: 'Draft'
        }
    }

    const handleVersionSelect = (versionId) => {
        console.log('VersionSelector: handleVersionSelect called with versionId:', versionId, 'type:', typeof versionId)
        setIsOpen(false)
        if (onVersionChange) {
            // Convert to number to match original select behavior 
            const numericId = parseInt(versionId)
            console.log('VersionSelector: calling onVersionChange with numericId:', numericId, 'type:', typeof numericId)
            onVersionChange(numericId)
        } else {
            console.warn('VersionSelector: onVersionChange is not defined')
        }
    }

    if (availableVersions.length === 0) {
        return null
    }

    const currentStatus = currentVersion ? getVersionStatus(currentVersion) : null
    const CurrentIcon = currentStatus?.icon || FileText

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Current version display */}
            <button
                onClick={() => {
                    console.log('VersionSelector: Toggle button clicked, isOpen:', isOpen)
                    setIsOpen(!isOpen)
                }}
                className="flex items-center space-x-2 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0"
            >
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                    {currentVersion && (
                        <>
                            <CurrentIcon className={`w-4 h-4 flex-shrink-0 ${currentStatus.color}`} />
                            <div className="min-w-0 flex-1 text-left">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                    {currentVersion.description || `Version ${currentVersion.version_number}`}
                                </div>
                                <div className="text-xs text-gray-500">
                                    v{currentVersion.version_number} • {currentStatus.label}
                                </div>
                            </div>
                        </>
                    )}
                    {!currentVersion && (
                        <div className="text-sm text-gray-500">Select version...</div>
                    )}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
                    {availableVersions.map((version) => {
                        const status = getVersionStatus(version)
                        const StatusIcon = status.icon
                        const isSelected = currentVersion?.id === version.id

                        return (
                            <button
                                key={version.id}
                                onClick={() => handleVersionSelect(version.id)}
                                className={`w-full px-3 py-2 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 border-b border-gray-100 last:border-b-0 ${isSelected ? status.bgColor : ''
                                    }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <StatusIcon className={`w-4 h-4 flex-shrink-0 ${status.color}`} />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium text-gray-900 truncate">
                                            {version.description || `Version ${version.version_number}`}
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center space-x-1">
                                            <span>v{version.version_number}</span>
                                            <span>•</span>
                                            <span className={status.color}>{status.label}</span>
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

export default VersionSelector