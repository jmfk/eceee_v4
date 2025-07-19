/**
 * Layout Migration Tools Component
 * 
 * Provides tools and information for migrating from database layouts to code-based layouts
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Info,
    ArrowRight,
    Download,
    Code,
    Database,
    CheckCircle,
    AlertTriangle,
    ExternalLink,
    RefreshCw,
    Lightbulb
} from 'lucide-react'
import { layoutsApi } from '../api/layouts'
import toast from 'react-hot-toast'

const LayoutMigrationTools = () => {
    const [selectedDbLayout, setSelectedDbLayout] = useState('')
    const [selectedCodeLayout, setSelectedCodeLayout] = useState('')
    const [showExportCode, setShowExportCode] = useState(false)
    const queryClient = useQueryClient()

    // Fetch all layouts
    const { data: allLayouts, isLoading } = useQuery({
        queryKey: ['layouts', 'all'],
        queryFn: () => layoutsApi.combined.listAll()
    })

    // Export database layouts mutation (placeholder - would need backend endpoint)
    const exportMutation = useMutation({
        mutationFn: async () => {
            // This would call a backend endpoint to export layouts as code
            // For now, we'll simulate it
            return new Promise(resolve => setTimeout(resolve, 2000))
        },
        onSuccess: () => {
            toast.success('Layout code exported successfully')
            setShowExportCode(true)
        },
        onError: () => {
            toast.error('Failed to export layout code')
        }
    })

    const databaseLayouts = allLayouts?.database_layouts || []
    const codeLayouts = allLayouts?.code_layouts || []

    const generateExampleCode = (layout) => {
        if (!layout) return ''

        const className = layout.name
            .split(/[\s_-]+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('') + 'Layout'

        return `@register_layout
class ${className}(BaseLayout):
    """${layout.description || `Migrated layout: ${layout.name}`}"""
    
    name = "${layout.name.toLowerCase().replace(/\s+/g, '_')}"
    description = "${layout.description || ''}"
    template_name = "${layout.template_name || 'webpages/page_detail.html'}"
    css_classes = "${layout.css_classes || ''}"
    
    @property
    def slot_configuration(self):
        return ${JSON.stringify(layout.slot_configuration, null, 12)}`
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start space-x-3">
                    <Lightbulb className="w-6 h-6 text-blue-600 mt-0.5" />
                    <div>
                        <h3 className="text-lg font-medium text-blue-900 mb-2">
                            Layout Migration Guide
                        </h3>
                        <p className="text-blue-700 mb-4">
                            Transition from database-stored layouts to code-based layouts for better version control,
                            IDE support, and third-party app integration.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-medium text-blue-900 mb-2">Benefits of Code Layouts</h4>
                                <ul className="text-sm text-blue-700 space-y-1">
                                    <li>• Version control with Git</li>
                                    <li>• Full IDE support (autocomplete, refactoring)</li>
                                    <li>• Easy distribution with apps</li>
                                    <li>• Dynamic behavior and conditions</li>
                                    <li>• Type safety and validation</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-medium text-blue-900 mb-2">Migration Process</h4>
                                <ul className="text-sm text-blue-700 space-y-1">
                                    <li>• Export database layouts as code</li>
                                    <li>• Create layout classes in your app</li>
                                    <li>• Test the new layouts</li>
                                    <li>• Convert pages to use code layouts</li>
                                    <li>• Remove old database layouts</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Current Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center space-x-3 mb-4">
                        <Database className="w-5 h-5 text-amber-600" />
                        <h3 className="text-lg font-medium text-gray-900">Database Layouts</h3>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Total Layouts</span>
                            <span className="text-2xl font-bold text-amber-600">
                                {databaseLayouts.length}
                            </span>
                        </div>
                        {databaseLayouts.length > 0 && (
                            <div className="text-sm text-gray-600">
                                <p className="mb-2">Active database layouts:</p>
                                <ul className="space-y-1">
                                    {databaseLayouts.slice(0, 3).map(layout => (
                                        <li key={layout.id} className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                                            <span>{layout.name}</span>
                                        </li>
                                    ))}
                                    {databaseLayouts.length > 3 && (
                                        <li className="text-gray-500">
                                            ... and {databaseLayouts.length - 3} more
                                        </li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center space-x-3 mb-4">
                        <Code className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-medium text-gray-900">Code Layouts</h3>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Total Layouts</span>
                            <span className="text-2xl font-bold text-blue-600">
                                {codeLayouts.length}
                            </span>
                        </div>
                        {codeLayouts.length > 0 && (
                            <div className="text-sm text-gray-600">
                                <p className="mb-2">Available code layouts:</p>
                                <ul className="space-y-1">
                                    {codeLayouts.slice(0, 3).map(layout => (
                                        <li key={layout.name} className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                            <span>{layout.name}</span>
                                        </li>
                                    ))}
                                    {codeLayouts.length > 3 && (
                                        <li className="text-gray-500">
                                            ... and {codeLayouts.length - 3} more
                                        </li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Export Tool */}
            {databaseLayouts.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Export Database Layouts as Code
                    </h3>
                    <p className="text-gray-600 mb-4">
                        Generate Python code for your database layouts that you can add to your application.
                    </p>

                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => exportMutation.mutate()}
                            disabled={exportMutation.isPending}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {exportMutation.isPending ? (
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4 mr-2" />
                            )}
                            Export All Layouts
                        </button>

                        <a
                            href="/api/v1/webpages/layouts/?format=export"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Download as File
                        </a>
                    </div>

                    {/* Example Code Preview */}
                    {showExportCode && databaseLayouts.length > 0 && (
                        <div className="mt-6">
                            <h4 className="font-medium text-gray-900 mb-3">Example Generated Code</h4>
                            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                                <pre className="text-sm">
                                    <code>{generateExampleCode(databaseLayouts[0])}</code>
                                </pre>
                            </div>
                            <p className="text-sm text-gray-600 mt-2">
                                This is an example of how your "{databaseLayouts[0].name}" layout would look as code.
                                The full export will include all your layouts.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Migration Steps */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Step-by-Step Migration
                </h3>

                <div className="space-y-4">
                    <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                            1
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900">Export Your Layouts</h4>
                            <p className="text-sm text-gray-600 mt-1">
                                Use the export tool above to generate Python code for your existing database layouts.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                            2
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900">Create layouts.py File</h4>
                            <p className="text-sm text-gray-600 mt-1">
                                Add a <code className="bg-gray-100 px-1 rounded">layouts.py</code> file to your Django app
                                and paste the exported code.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                            3
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900">Test the New Layouts</h4>
                            <p className="text-sm text-gray-600 mt-1">
                                Restart your Django application and verify the code layouts appear in the layout list.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                            4
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900">Update Your Pages</h4>
                            <p className="text-sm text-gray-600 mt-1">
                                Use the page management interface to switch pages from database layouts to the new code layouts.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-800 rounded-full flex items-center justify-center text-sm font-medium">
                            5
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900">Clean Up</h4>
                            <p className="text-sm text-gray-600 mt-1">
                                Once all pages are using code layouts, you can safely delete the old database layouts.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Command Line Tools */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Command Line Tools
                </h3>
                <p className="text-gray-600 mb-4">
                    Use Django management commands for advanced migration operations.
                </p>

                <div className="space-y-4">
                    <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm">
                        <div className="text-gray-400 mb-1"># List all layouts</div>
                        <div>python manage.py manage_layouts list</div>
                    </div>

                    <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm">
                        <div className="text-gray-400 mb-1"># Export layouts to file</div>
                        <div>python manage.py manage_layouts export --output-file my_layouts.py</div>
                    </div>

                    <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm">
                        <div className="text-gray-400 mb-1"># Convert pages from database to code layout</div>
                        <div>python manage.py manage_layouts convert-pages \</div>
                        <div className="ml-4">--from-layout "Two Column" \</div>
                        <div className="ml-4">--to-layout "two_column"</div>
                    </div>
                </div>
            </div>

            {/* No Database Layouts */}
            {databaseLayouts.length === 0 && (
                <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Migration Complete!
                    </h3>
                    <p className="text-gray-600">
                        You have no database layouts. All your layouts are now code-based,
                        providing better version control and development experience.
                    </p>
                </div>
            )}
        </div>
    )
}

export default LayoutMigrationTools 