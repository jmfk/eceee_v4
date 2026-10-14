import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'

import { searchFonts } from '../../utils/googleFonts'

const fontFamilyName = (value = '') => value.split(',')[0].replace(/["']/g, '').trim()
const replaceFontFamilyName = (value = '', family = '') => {
    if (!family) return ''
    const fallbackStart = value.indexOf(',')
    return fallbackStart >= 0 ? `${family}${value.slice(fallbackStart)}` : family
}
const colorInputValue = (value = '') => /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'

const GoogleFontSearch = ({ installedFonts, onChoose, chooseLabel = 'Install' }) => {
    const [query, setQuery] = useState('')
    const matches = useMemo(() => {
        const installed = new Set(installedFonts.map((font) => font.family))
        return searchFonts(query).filter((font) => !installed.has(font.family)).slice(0, 20)
    }, [query, installedFonts])

    return <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
        <label className="relative block">
            <span className="sr-only">Search Google Fonts</span>
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Google Fonts" className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm" />
        </label>
        <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white">
            {matches.map((font) => <button key={font.family} type="button" onClick={() => onChoose(font)} className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left last:border-b-0 hover:bg-blue-50">
                <span><span className="block text-sm font-medium text-gray-900">{font.family}</span><span className="block text-xs text-gray-500">{font.category}</span></span>
                <span className="shrink-0 text-xs font-medium text-blue-700">{chooseLabel}</span>
            </button>)}
            {matches.length === 0 && <p className="px-3 py-4 text-center text-sm text-gray-500">No matching font in the Google Fonts catalog.</p>}
        </div>
    </div>
}

export const ThemeFontField = ({ id, label, value, fonts, disabled, onChange, onInstall }) => {
    const [browsing, setBrowsing] = useState(false)
    const currentFamily = fontFamilyName(value)
    const installedFamilies = new Set(fonts.map((font) => font.family))

    const content = <>
        {label && <label htmlFor={id} className="text-xs font-medium text-gray-700">{label}</label>}
        <select id={id} value={currentFamily} disabled={disabled} onChange={(event) => onChange(replaceFontFamilyName(value, event.target.value))} className="mt-0.5 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:bg-gray-50">
            <option value="">Theme default</option>
            {currentFamily && !installedFamilies.has(currentFamily) && <option value={currentFamily}>{currentFamily} (not installed)</option>}
            {fonts.map((font) => <option key={font.family} value={font.family}>{font.family}</option>)}
        </select>
        <button type="button" disabled={disabled} onClick={() => setBrowsing((current) => !current)} className="mt-1 text-xs font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50">{browsing ? 'Close Google Fonts' : 'Add from Google Fonts'}</button>
        {browsing && <div className="mt-2"><GoogleFontSearch installedFonts={fonts} chooseLabel="Install and use" onChoose={(font) => { onInstall(font); onChange(replaceFontFamilyName(value, font.family)); setBrowsing(false) }} /></div>}
    </>
    return label ? <div className="min-w-0">{content}</div> : content
}

export const ThemeFontsEditor = ({ fonts, onInstall }) => {
    const [showSearch, setShowSearch] = useState(false)
    return <section className="space-y-4">
        <div><h2 className="text-xs font-semibold uppercase tracking-wide text-blue-700">Theme fonts</h2><h3 className="mt-1 text-lg font-semibold text-gray-900">Installed font families</h3><p className="mt-2 text-sm text-gray-600">Only fonts installed in the theme can be selected in typography properties.</p></div>
        <div className="space-y-2">
            {fonts.map((font) => <article key={font.family} className="rounded-md border border-gray-200 bg-white p-3">
                <p className="text-sm font-semibold text-gray-900">{font.family}</p>
                <p className="mt-1 text-xs text-gray-500">Weights: {(font.variants || ['400']).join(', ')}</p>
                {font.usage?.length > 0 && <p className="mt-1 text-xs text-gray-500">Used by {font.usage.join(', ')}</p>}
            </article>)}
            {fonts.length === 0 && <p className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">No fonts are installed in this theme.</p>}
        </div>
        <button type="button" onClick={() => setShowSearch((current) => !current)} className="inline-flex items-center gap-2 rounded-md border border-blue-600 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"><Plus className="h-4 w-4" />{showSearch ? 'Close font search' : 'Add Google Font'}</button>
        {showSearch && <GoogleFontSearch installedFonts={fonts} onChoose={(font) => { onInstall(font); setShowSearch(false) }} />}
    </section>
}

const AddPaletteColor = ({ initialValue = '#000000', colors, onAdd, onDone }) => {
    const [name, setName] = useState('')
    const [value, setValue] = useState(colorInputValue(initialValue))
    const trimmedName = name.trim()
    const validName = trimmedName.length <= 100
        && /^[A-Za-z][A-Za-z0-9_-]*$/.test(trimmedName)
        && !colors.some((color) => color.name === trimmedName)

    return <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
        <label className="block text-xs font-medium text-gray-700">Color name<input aria-label="New theme color name" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder="e.g. accent" className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm" /></label>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700">Color<input aria-label="New theme color value" type="color" value={value} onChange={(event) => setValue(event.target.value)} className="h-9 w-12 rounded border border-gray-300" /><input value={value} onChange={(event) => setValue(event.target.value)} className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 font-mono text-xs" /></label>
        {trimmedName && !validName && <p className="text-xs text-red-600">Use a unique name beginning with a letter; letters, numbers, dashes and underscores are supported.</p>}
        <div className="flex gap-2"><button type="button" disabled={!validName || !/^#[0-9a-f]{6}$/i.test(value)} onClick={() => { onAdd({ name: trimmedName, value }); onDone?.() }} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Add to theme</button>{onDone && <button type="button" onClick={onDone} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700">Cancel</button>}</div>
    </div>
}

export const ThemePaletteEditor = ({ colors, onChange, onAdd }) => {
    const [adding, setAdding] = useState(false)
    return <section className="space-y-3">
        <div><h2 className="text-xs font-semibold uppercase tracking-wide text-blue-700">Theme palette</h2><p className="mt-1 text-xs text-gray-600">These named colors are available to every color property in the Designer.</p></div>
        <div className="space-y-2">{colors.map((color, index) => <label key={color.name} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2">
            <input aria-label={`${color.name} color picker`} type="color" value={colorInputValue(color.value)} onChange={(event) => onChange(index, event.target.value)} className="h-9 w-12 rounded border border-gray-300" />
            <span className="min-w-0"><span className="block truncate text-xs font-medium text-gray-800">{color.name}</span><input aria-label={`${color.name} palette value`} value={color.value} onChange={(event) => onChange(index, event.target.value)} className="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1 font-mono text-xs" /></span>
        </label>)}</div>
        <button type="button" onClick={() => setAdding((current) => !current)} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900"><Plus className="h-3.5 w-3.5" />Add color</button>
        {adding && <AddPaletteColor colors={colors} onAdd={onAdd} onDone={() => setAdding(false)} />}
    </section>
}

export const ThemeColorField = ({ id, label, ariaLabel, value, colors, disabled, onChange, onAdd }) => {
    const [adding, setAdding] = useState(false)
    const paletteNames = new Set(colors.map((color) => color.name))
    const customOptionValue = paletteNames.has(value) ? '__custom__' : value
    const selected = paletteNames.has(value) ? value : customOptionValue
    const resolved = colors.find((color) => color.name === value)?.value || value

    return <div className="min-w-0">
        <label htmlFor={id} className="text-xs font-medium text-gray-700">{label}</label>
        <div className="mt-0.5 flex gap-2">
            <select id={id} aria-label={ariaLabel} value={selected} disabled={disabled} onChange={(event) => onChange(event.target.value === '__custom__' ? '' : event.target.value)} className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs disabled:bg-gray-50">
                {colors.map((color) => <option key={color.name} value={color.name}>{color.name}</option>)}
                <option value={customOptionValue}>Custom color</option>
            </select>
            <input aria-label={`${label} custom color`} type="color" disabled={disabled} value={colorInputValue(resolved)} onChange={(event) => onChange(event.target.value)} className="h-[30px] w-10 rounded border border-gray-300" />
        </div>
        {!paletteNames.has(value) && <button type="button" disabled={disabled} onClick={() => setAdding((current) => !current)} className="mt-1 text-xs font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50">Add this color to theme palette</button>}
        {adding && <div className="mt-2"><AddPaletteColor initialValue={resolved} colors={colors} onAdd={({ name, value: colorValue }) => { onAdd({ name, value: colorValue }); onChange(name) }} onDone={() => setAdding(false)} /></div>}
    </div>
}
