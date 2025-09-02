import React from 'react'

/**
 * ButtonRenderer - React renderer for Button widgets
 * Maintains parity with Django template rendering
 */
const ButtonRenderer = ({ configuration }) => {
  const {
    text = 'Click me',
    url = '#',
    style = 'primary',
    size = 'medium',
    alignment = 'left',
    target = '_self',
    css_class = '',
    icon = '',
    disabled = false
  } = configuration

  // Build button style classes
  const styleClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700',
    outline: 'bg-transparent text-blue-600 border-2 border-blue-600 hover:bg-blue-600 hover:text-white',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-green-600 text-white hover:bg-green-700'
  }

  // Build size classes
  const sizeClasses = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg'
  }

  // Build alignment classes
  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    full: 'w-full'
  }

  const buttonClasses = [
    'button-widget-btn',
    'inline-flex items-center justify-center',
    'font-medium rounded-lg transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
    styleClasses[style] || styleClasses.primary,
    sizeClasses[size] || sizeClasses.medium,
    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    alignment === 'full' ? 'w-full' : '',
    css_class
  ].filter(Boolean).join(' ')

  const containerClasses = [
    'button-widget',
    alignmentClasses[alignment] || 'text-left'
  ].filter(Boolean).join(' ')

  // Icon mapping (simplified - in production, use icon library)
  const renderIcon = () => {
    if (!icon) return null
    
    const iconMap = {
      'arrow-right': '→',
      'arrow-left': '←',
      'download': '↓',
      'external': '↗',
      'plus': '+',
      'minus': '-',
      'check': '✓',
      'close': '×'
    }

    return (
      <span className="button-widget-icon mr-2">
        {iconMap[icon] || icon}
      </span>
    )
  }

  const handleClick = (e) => {
    if (disabled) {
      e.preventDefault()
      return
    }
    
    // In preview mode, prevent navigation
    if (url === '#' || !url) {
      e.preventDefault()
    }
  }

  return (
    <div className={containerClasses}>
      <a
        href={url}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        className={buttonClasses}
        onClick={handleClick}
        aria-disabled={disabled}
      >
        {renderIcon()}
        <span className="button-widget-text">
          {text}
        </span>
      </a>
    </div>
  )
}

export default ButtonRenderer