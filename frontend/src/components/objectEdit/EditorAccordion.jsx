import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function EditorAccordion({ title, children, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen)
    return <section className="border-b border-gray-200">
        <h2>
            <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
                {title}<ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
        </h2>
        {open && <div className="px-4 pb-4">{children}</div>}
    </section>
}
