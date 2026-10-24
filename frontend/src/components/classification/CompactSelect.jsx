import React, { forwardRef, useRef, useState } from 'react'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { Check, ChevronDown } from 'lucide-react'
import './compact-select.css'

// Keep native required-field validation while Headless UI owns popup interaction.
const CompactSelect = forwardRef(function CompactSelect({ children, value = '', onChange, label, required, disabled, className = '' }, ref) {
    const buttonRef = useRef(null)
    const [invalid, setInvalid] = useState(false)
    const options = React.Children.toArray(children).filter(React.isValidElement)
    const selected = options.find(option => String(option.props.value ?? option.props.children) === String(value))
    const change = next => {
        setInvalid(false)
        onChange?.({ target: { value: next } })
    }
    return <>
        <Listbox value={String(value)} onChange={change} disabled={disabled}>
            <ListboxButton data-filled={String(value).length > 0} role="combobox" aria-label={label} aria-required={required || undefined} aria-invalid={invalid || undefined}
                ref={node => { buttonRef.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node }}
                className={`cms-compact-select ${className}`}>
                <span className="cms-compact-select-value truncate">{selected?.props.children || 'Choose…'}</span>
                <ChevronDown size={14} aria-hidden="true" />
            </ListboxButton>
            <ListboxOptions anchor={{ to: 'bottom start', gap: 4, padding: 8 }} className="cms-compact-select-options" data-cms-select-options="">
                {options.map(option => {
                    const key = String(option.props.value ?? option.props.children)
                    return <ListboxOption key={key} value={key} disabled={option.props.disabled} className="cms-compact-select-option">
                        {({ selected }) => <><span className="truncate">{option.props.children}</span>{selected && <Check size={13} aria-hidden="true" />}</>}
                    </ListboxOption>
                })}
            </ListboxOptions>
        </Listbox>
        {required && <select hidden aria-hidden="true" tabIndex={-1} required disabled={disabled} value={value} onChange={onChange}
            onInvalid={event => { event.preventDefault(); setInvalid(true); buttonRef.current?.focus() }}>
            {children}
        </select>}
        {invalid && <span role="alert" className="cms-compact-select-error">Choose an option.</span>}
    </>
})

export default CompactSelect
