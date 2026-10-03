import React from 'react'

const FieldHelpText = ({ children, id, className = '' }) => {
    if (!children) return null

    return (
        <div id={id} className={`text-sm italic text-gray-500 ${className}`.trim()}>
            {children}
        </div>
    )
}

export default FieldHelpText
