import React, { useState } from 'react'
import {
    Eye,
    Code,
    Settings,
    CheckCircle,
    Layers,
    Zap,
    Palette,
    Users
} from 'lucide-react'
import FieldTypeTest from './FieldTypeTest'
import AdvancedFieldDemo from './AdvancedFieldDemo'
import { DynamicFormRenderer, EnhancedSchemaDrivenForm } from './forms'

/**
 * FormFieldShowcase Component
 * 
 * Comprehensive showcase of the Custom React-Based Form Field Widgets System.
 * Demonstrates all capabilities and integration approaches.
 */
const FormFieldShowcase = () => {
    const [activeDemo, setActiveDemo] = useState('overview')

    const demos = [
        {
            id: 'overview',
            title: 'System Overview',
            icon: Eye,
            description: 'Overview of the form field widgets system'
        },
        {
            id: 'field-types',
            title: 'Field Types Registry',
            icon: Layers,
            description: 'All available field types and components'
        },
        {
            id: 'dynamic-forms',
            title: 'Dynamic Forms',
            icon: Zap,
            description: 'Schema-driven dynamic form rendering'
        },
        {
            id: 'advanced',
            title: 'Advanced Fields',
            icon: Palette,
            description: 'Advanced field types and capabilities'
        },
        {
            id: 'integration',
            title: 'System Integration',
            icon: Settings,
            description: 'Integration with existing form systems'
        }
    ]

    const systemStats = {
        fieldTypes: 21,
        components: 15,
        integrations: 4,
        features: [
            'Backend-driven field type definitions',
            'Dynamic component loading',
            'Real-time validation integration',
            'Advanced field types (color, slider, tags, date range)',
            'Password strength indicators',
            'Multi-select with search and tagging',
            'Accessibility compliance',
            'Mobile responsive design',
            'Extensible architecture'
        ]
    }

    const renderOverview = () => (
        <div className="space-y-8">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    Custom React-Based Form Field Widgets System
                </h2>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                    A comprehensive, extensible form field system that provides advanced UI components
                    with integrated validation, accessibility features, and seamless backend integration.
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-2">{systemStats.fieldTypes}</div>
                    <div className="text-blue-800 font-medium">Field Types</div>
                    <div className="text-sm text-blue-600 mt-1">Backend-defined types</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <div className="text-3xl font-bold text-green-600 mb-2">{systemStats.components}</div>
                    <div className="text-green-800 font-medium">React Components</div>
                    <div className="text-sm text-green-600 mt-1">Ready-to-use components</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-2">{systemStats.integrations}</div>
                    <div className="text-purple-800 font-medium">Integration Points</div>
                    <div className="text-sm text-purple-600 mt-1">Form system integrations</div>
                </div>
            </div>

            {/* Features */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                    Key Features
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {systemStats.features.map((feature, index) => (
                        <div key={index} className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <span className="text-gray-700">{feature}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Architecture Diagram */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">System Architecture</h3>
                <div className="flex items-center justify-center space-x-8">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                            <Code className="w-8 h-8 text-blue-600" />
                        </div>
                        <div className="text-sm font-medium">Backend Registry</div>
                        <div className="text-xs text-gray-500">Field Definitions</div>
                    </div>
                    <div className="text-2xl text-gray-400">→</div>
                    <div className="text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mb-2">
                            <Zap className="w-8 h-8 text-green-600" />
                        </div>
                        <div className="text-sm font-medium">API Layer</div>
                        <div className="text-xs text-gray-500">Dynamic Loading</div>
                    </div>
                    <div className="text-2xl text-gray-400">→</div>
                    <div className="text-center">
                        <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                            <Palette className="w-8 h-8 text-purple-600" />
                        </div>
                        <div className="text-sm font-medium">React Components</div>
                        <div className="text-xs text-gray-500">UI Rendering</div>
                    </div>
                </div>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                                <Users className="w-5 h-5 text-white" />
                            </div>
                            <h1 className="text-xl font-semibold text-gray-900">
                                Form Field Widgets Showcase
                            </h1>
                        </div>
                        <div className="text-sm text-gray-500">
                            ECEEE v4 • Phase 3 Complete
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex space-x-8">
                        {demos.map((demo) => {
                            const Icon = demo.icon
                            return (
                                <button
                                    key={demo.id}
                                    onClick={() => setActiveDemo(demo.id)}
                                    className={`
                                        flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                                        ${activeDemo === demo.id
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }
                                    `}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{demo.title}</span>
                                </button>
                            )
                        })}
                    </nav>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeDemo === 'overview' && renderOverview()}
                {activeDemo === 'field-types' && <FieldTypeTest />}
                {activeDemo === 'advanced' && <AdvancedFieldDemo />}
                {activeDemo === 'dynamic-forms' && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-gray-900">Dynamic Form Examples</h2>
                        <p className="text-gray-600">
                            Examples of dynamic form rendering using the new field system.
                        </p>
                        {/* Add dynamic form examples here */}
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <p className="text-gray-500">Dynamic form examples coming soon...</p>
                        </div>
                    </div>
                )}
                {activeDemo === 'integration' && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-gray-900">System Integration</h2>
                        <p className="text-gray-600">
                            Integration examples with existing form systems.
                        </p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white border border-gray-200 rounded-lg p-6">
                                <h3 className="text-lg font-medium mb-3">Widget Editor Integration</h3>
                                <p className="text-gray-600 text-sm mb-4">
                                    Enhanced widget configuration forms with advanced field types.
                                </p>
                                <div className="bg-gray-50 p-4 rounded border">
                                    <code className="text-sm">
                                        &lt;EnhancedWidgetForm<br />
                                        &nbsp;&nbsp;schema={'{widgetSchema}'}<br />
                                        &nbsp;&nbsp;config={'{widgetConfig}'}<br />
                                        /&gt;
                                    </code>
                                </div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-6">
                                <h3 className="text-lg font-medium mb-3">Schema-Driven Forms</h3>
                                <p className="text-gray-600 text-sm mb-4">
                                    Enhanced schema-driven forms with field type mapping.
                                </p>
                                <div className="bg-gray-50 p-4 rounded border">
                                    <code className="text-sm">
                                        &lt;EnhancedSchemaDrivenForm<br />
                                        &nbsp;&nbsp;schema={'{jsonSchema}'}<br />
                                        &nbsp;&nbsp;useNewFieldSystem={'{true}'}<br />
                                        /&gt;
                                    </code>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

FormFieldShowcase.displayName = 'FormFieldShowcase'

export default FormFieldShowcase
