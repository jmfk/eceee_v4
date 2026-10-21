import { useState } from 'react'
import { DEFAULT_TEXT_OUTLINE, textOutlineShadow } from '../../utils/textOutlineStyles'

const inputClass = 'mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

// Keep intermediate input local so clearing a field or typing a decimal/sign
// does not overwrite the last valid value used by the preview and save payload.
function NumericStyleField({ label, value, min, max, step, onChange }) {
    const [draft, setDraft] = useState(null)
    return <label className="block text-xs font-medium">{label}<input className={inputClass}
        type="number" min={min} max={max} step={step} value={draft ?? value}
        onChange={event => {
            setDraft(event.target.value)
            const number = event.target.valueAsNumber
            if (Number.isFinite(number) && number >= min && number <= max) onChange(number)
        }}
        onBlur={() => {
            if (draft !== null && draft.trim() !== '') {
                const number = Number(draft)
                if (Number.isFinite(number)) onChange(Math.min(max, Math.max(min, number)))
            }
            setDraft(null)
        }} /></label>
}

export default function TextOutlineStylesEditor({ styles = {}, onChange }) {
    const [selected, setSelected] = useState('')
    const [removed, setRemoved] = useState(null)
    const key = Object.hasOwn(styles, selected) ? selected : Object.keys(styles)[0]
    const style = key ? { ...DEFAULT_TEXT_OUTLINE, ...styles[key] } : null
    const update = patch => onChange({ ...styles, [key]: { ...style, ...patch } })
    const add = () => {
        let number = 1
        while (Object.hasOwn(styles, `outline${number}`)) number++
        const nextKey = `outline${crypto.randomUUID().replace(/-/g, '')}`
        onChange({ ...styles, [nextKey]: { ...DEFAULT_TEXT_OUTLINE, name: `Text outline ${number}` } })
        setSelected(nextKey)
    }
    const numberField = (field, label, min, max, step = 1) => <NumericStyleField
        key={`${key}:${field}`} label={label} value={style[field]} min={min} max={max} step={step}
        onChange={value => update({ [field]: value })} />

    return <section className="space-y-4 text-gray-800 dark:text-gray-100">
        <div><h2 className="text-lg font-semibold">Text outline styles</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Named effects shared by this theme. Select them wherever text outline is available.</p></div>
        {Object.keys(styles).length > 0 && <label className="block text-xs font-medium">Text outline style<select className={inputClass} value={key} onChange={event => setSelected(event.target.value)}>{Object.entries(styles).map(([id, item]) => <option key={id} value={id}>{item.name || id}</option>)}</select></label>}
        <button type="button" onClick={add} disabled={Object.keys(styles).length >= 100} className="min-h-8 text-sm font-medium text-blue-700 dark:text-blue-300 disabled:opacity-50">Add text outline style</button>
        {!style && <p className="text-sm text-gray-500">No text outline styles yet.</p>}
        {style && <>
            <label className="block text-xs font-medium">Style name<input className={inputClass} value={style.name} maxLength={100} onChange={event => update({ name: event.target.value })} /></label>
            <label className="block text-xs font-medium">Effect<select className={inputClass} value={style.style} onChange={event => update({ style: event.target.value })}><option value="outline">Outline</option><option value="gradientBlur">Gradient blur</option><option value="dropShadow">Drop shadow</option></select></label>
            <label className="block text-xs font-medium">Color<select className={inputClass} value={style.colorMode} onChange={event => update({ colorMode: event.target.value })}><option value="same">Same as text</option><option value="white">White</option><option value="black">Black</option><option value="complement">Complement of text</option><option value="rgb">Custom RGB</option></select></label>
            {style.colorMode === 'rgb' && <label className="block text-xs font-medium">RGB color<input aria-label="RGB color" className={inputClass} type="color" value={style.color} onChange={event => update({ color: event.target.value })} /></label>}
            <div className="grid grid-cols-2 gap-3">
                {numberField('thickness', 'Thickness (px)', 0, 20, 0.1)}
                {numberField('opacity', 'Opacity (%)', 0, 100)}
                {style.style !== 'outline' && numberField('radius', 'Gradient / blur radius (px)', 0, 100, 0.1)}
                {style.style === 'dropShadow' && <>{numberField('angle', 'Angle (°)', -360, 360)}{numberField('offset', 'Offset (px)', -100, 100, 0.1)}</>}
            </div>
            <div aria-label="Text outline preview" className="space-y-3 py-4">
                {[{ backgroundColor: '#eeeeee', color: '#2463a6' }, { backgroundColor: '#222222', color: '#d9b36b' }].map(colors => <div key={colors.backgroundColor} className="overflow-hidden px-4 py-8 text-center text-2xl font-semibold" style={{ ...colors, textShadow: textOutlineShadow(style) }}>Text outline preview</div>)}
            </div>
            <button type="button" className="min-h-8 text-sm text-gray-600 dark:text-gray-300" onClick={() => {
                setRemoved({ key, style: styles[key] })
                const next = { ...styles }; delete next[key]; onChange(next)
            }}>Remove style</button>
        </>}
        {removed && <p role="status" className="text-sm">Style removed. <button type="button" className="min-h-8 font-medium text-blue-700 dark:text-blue-300" onClick={() => {
            onChange({ ...styles, [removed.key]: removed.style }); setSelected(removed.key); setRemoved(null)
        }}>Undo</button></p>}
    </section>
}
