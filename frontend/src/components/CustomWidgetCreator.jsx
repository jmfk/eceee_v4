import { Code, FileText, GitBranch, Settings, X, BookOpen, ExternalLink } from 'lucide-react'

const CustomWidgetCreator = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Code className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <div className="text-xl font-semibold text-gray-900" role="heading" aria-level="2">Custom Widget Development</div>
                            <div className="text-sm text-gray-500">Code-Based Widget System</div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Info Banner */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                            <Settings className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <div className="font-medium text-blue-900" role="heading" aria-level="3">Widget System Updated</div>
                                <div className="text-blue-700 text-sm mt-1">
                                    Widget types are now defined in code for better maintainability, type safety, and version control.
                                    Custom widgets can no longer be created through the UI.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Development Guide */}
                    <div className="space-y-4">
                        <div className="text-lg font-medium text-gray-900 flex items-center" role="heading" aria-level="3">
                            <GitBranch className="h-5 w-5 mr-2 text-gray-600" />
                            How to Add Custom Widgets
                        </div>

                        <div className="space-y-4">
                            {/* Step 1 */}
                            <div className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                                        1
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900" role="heading" aria-level="4">Create Pydantic Model</div>
                                        <div className="text-gray-600 text-sm mt-1">
                                            Define your widget's configuration schema in your widget app's <code className="bg-gray-100 px-1 rounded">widget_models.py</code>
                                        </div>
                                        <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono text-gray-700">
                                            {`class MyCustomWidgetConfig(BaseModel):
    title: str = Field(..., description="Widget title")
    content: str = Field(..., description="Widget content")
    style: Literal["primary", "secondary"] = Field("primary", description="Style variant")`}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                                        2
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900" role="heading" aria-level="4">Register Widget Class</div>
                                        <div className="text-gray-600 text-sm mt-1">
                                            Create a widget class in your widget app's <code className="bg-gray-100 px-1 rounded">widgets/</code> directory
                                        </div>
                                        <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono text-gray-700">
                                            {`@register_widget_type
class MyCustomWidget(BaseWidget):
    name = "My Custom Widget"
    description = "A custom widget for special content"
    template_name = "webpages/widgets/my_custom.html"
    configuration_model = MyCustomWidgetConfig`}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                                        3
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900" role="heading" aria-level="4">Create Template</div>
                                        <div className="text-gray-600 text-sm mt-1">
                                            Add your widget template in <code className="bg-gray-100 px-1 rounded">backend/templates/webpages/widgets/</code>
                                        </div>
                                        <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono text-gray-700">
                                            {`<div class="my-custom-widget widget-{{config.style}}">
    <h3>{{config.title}}</div>
    <div class="content">{{config.content|safe}}</div>
</div>`}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Step 4 */}
                            <div className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">
                                        ✓
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900" role="heading" aria-level="4">Restart & Test</div>
                                        <div className="text-gray-600 text-sm mt-1">
                                            Restart the Django server for autodiscovery to pick up your new widget type
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Benefits */}
                    <div className="space-y-3">
                        <div className="text-lg font-medium text-gray-900" role="heading" aria-level="3">Benefits of Code-Based Widgets</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                    <GitBranch className="h-4 w-4 text-green-600" />
                                </div>
                                <div>
                                    <div className="font-medium text-gray-900 text-sm" role="heading" aria-level="4">Version Control</div>
                                    <div className="text-gray-600 text-xs">Track changes and collaborate with Git</div>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <Settings className="h-4 w-4 text-blue-600" />
                                </div>
                                <div>
                                    <div className="font-medium text-gray-900 text-sm" role="heading" aria-level="4">Type Safety</div>
                                    <div className="text-gray-600 text-xs">Pydantic validation and IDE support</div>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <FileText className="h-4 w-4 text-purple-600" />
                                </div>
                                <div>
                                    <div className="font-medium text-gray-900 text-sm" role="heading" aria-level="4">Documentation</div>
                                    <div className="text-gray-600 text-xs">Self-documenting schemas and tests</div>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                                    <Code className="h-4 w-4 text-orange-600" />
                                </div>
                                <div>
                                    <div className="font-medium text-gray-900 text-sm" role="heading" aria-level="4">Performance</div>
                                    <div className="text-gray-600 text-xs">No database queries for widget types</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Documentation Link */}
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                            <BookOpen className="h-5 w-5 text-gray-600" />
                            <div>
                                <div className="font-medium text-gray-900" role="heading" aria-level="4">Need Help?</div>
                                <div className="text-gray-600 text-sm mt-1">
                                    Check the codebase documentation and existing widget examples for more detailed guidance.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                    <div className="flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Got It
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CustomWidgetCreator 