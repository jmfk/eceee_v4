import React from 'react'
import { FileText } from 'lucide-react'
import DynamicFormRenderer from '../../components/forms/DynamicFormRenderer'

/**
 * Dynamic Form Widget
 * Embeds a form created in the Form Manager
 */
const DynamicFormWidget = ({ config = {} }) => {
    const {
        formName = '',
        showTitle = true,
        showDescription = true,
        anchor = ''
    } = config

    if (!formName) {
        return (
            <div className="p-8 text-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No form selected. Edit widget to choose a form.</p>
            </div>
        )
    }

    return (
        <div className="dynamic-form-widget-container" id={anchor}>
            <DynamicFormRenderer 
                formName={formName} 
                // We don't pass fields here, renderer will fetch them via formName
            />
        </div>
    )
}

// === COLOCATED METADATA ===
DynamicFormWidget.displayName = 'DynamicFormWidget'
DynamicFormWidget.widgetType = 'easy_widgets.DynamicFormWidget'

DynamicFormWidget.defaultConfig = {
    formName: '',
    showTitle: true,
    showDescription: true,
    componentStyle: 'default',
    anchor: ''
}

DynamicFormWidget.metadata = {
    name: 'Dynamic Form',
    description: 'Embed a form created in the Form Manager',
    category: 'form',
    icon: FileText,
    specialEditor: 'FormSpecialEditor',
    tags: ['form', 'dynamic', 'input', 'submit']
}

export default DynamicFormWidget

