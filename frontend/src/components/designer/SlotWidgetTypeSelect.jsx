import { useId, useRef, useState } from 'react'
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react'
import { Check, ChevronDown, X } from 'lucide-react'
import './slot-widget-type-select.css'
const unavailableOption = type => {
    const name = type.split('.').at(-1)
    const label = type.includes('*') ? 'Saved widget pattern'
        : /^[0-9a-f-]{32,36}$/i.test(name) ? 'Unavailable widget'
            : `${name.replace(/Widget$/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2')} (unavailable)`
    return { value: type, label, description: 'Saved selection that is not currently available in this theme.' }
}

export default function SlotWidgetTypeSelect({ label, value = [], onChange, options, disabled = false }) {
    const id = useId()
    const inputRef = useRef(null)
    const [query, setQuery] = useState('')
    const [focused, setFocused] = useState(false)
    const available = new Map(options.map(option => [option.value, option]))
    // Keep imported patterns and unavailable type IDs visible and removable.
    value.forEach(type => { if (!available.has(type)) available.set(type, unavailableOption(type)) })
    const filtered = [...available.values()].filter(option => `${option.label} ${option.description || ''} ${option.value}`.toLowerCase().includes(query.trim().toLowerCase()))

    return <Combobox multiple value={value} onChange={next => { onChange(next); setQuery('') }} disabled={disabled} onClose={() => setQuery('')} immediate>
        {({ open }) => <div className={`slot-widget-type-select${disabled ? ' is-disabled' : ''}`}>
            <div className={`slot-widget-type-field${open || focused || value.length ? ' is-filled' : ''}`}>
                <label htmlFor={id}>{label}</label>
                <div className="slot-widget-type-search">
                    <ComboboxInput ref={inputRef} id={id} aria-label={label} value={query}
                        onChange={event => setQuery(event.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                        placeholder={open || focused || value.length ? 'Search widget types…' : ''} />
                    <ComboboxButton aria-label={`Show ${label.toLowerCase()}`}><ChevronDown size={14} aria-hidden="true" /></ComboboxButton>
                </div>
                {value.length > 0 && <ul className="slot-widget-type-values" aria-label={`Selected ${label.toLowerCase()}`}>
                    {value.map(type => <li key={type} title={type}>
                        <span>{available.get(type).label}</span>
                        <button type="button" disabled={disabled} aria-label={`Remove ${available.get(type).label} (${type})`}
                            onClick={() => { onChange(value.filter(selected => selected !== type)); inputRef.current?.focus() }}><X size={12} aria-hidden="true" /></button>
                    </li>)}
                </ul>}
            </div>
            <ComboboxOptions anchor={{ to: 'bottom start', gap: 4, padding: 8 }} className="slot-widget-type-options">
                {filtered.map(option => <ComboboxOption key={option.value} value={option.value} title={option.value} className="slot-widget-type-option">
                    {({ selected }) => <><span><span className="slot-widget-type-name">{option.label}</span>{option.description && <span className="slot-widget-type-description">{option.description}</span>}</span>{selected && <Check size={14} aria-hidden="true" />}</>}
                </ComboboxOption>)}
                {!filtered.length && <div className="slot-widget-type-empty">No matching widget types.</div>}
            </ComboboxOptions>
        </div>}
    </Combobox>
}
