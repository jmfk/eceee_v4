import React from 'react'

/**
 * FormsRenderer - React renderer for Forms widgets
 */
const FormsRenderer = ({ configuration }) => {
  const {
    form_title = 'Contact Form',
    fields = [],
    submit_button_text = 'Submit',
    show_required_note = true,
    css_class = ''
  } = configuration

  // Default fields if none provided
  const formFields = fields.length > 0 ? fields : [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'message', label: 'Message', type: 'textarea', required: false }
  ]

  const handleSubmit = (e) => {
    e.preventDefault()
    // Preview mode - don't actually submit
  }

  return (
    <div className={`forms-widget ${css_class}`}>
      {form_title && <h3 className="text-xl font-bold mb-4">{form_title}</h3>}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {formFields.map((field, index) => (
          <div key={index} className="form-field">
            <label className="block text-sm font-medium mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            
            {field.type === 'textarea' ? (
              <textarea
                name={field.name}
                required={field.required}
                placeholder={field.placeholder || ''}
                rows={field.rows || 4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : field.type === 'select' ? (
              <select
                name={field.name}
                required={field.required}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select an option</option>
                {(field.options || []).map((option, i) => (
                  <option key={i} value={option.value || option}>
                    {option.label || option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type || 'text'}
                name={field.name}
                required={field.required}
                placeholder={field.placeholder || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        ))}
        
        {show_required_note && (
          <p className="text-sm text-gray-500">
            <span className="text-red-500">*</span> Required fields
          </p>
        )}
        
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          {submit_button_text}
        </button>
      </form>
    </div>
  )
}

export default FormsRenderer