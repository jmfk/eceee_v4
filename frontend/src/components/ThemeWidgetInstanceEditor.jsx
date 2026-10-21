import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import SchemaFieldRenderer from './forms/SchemaFieldRenderer'
import { useWidgetTheme } from '../contexts/WidgetThemeContext'
import { fieldTypeRegistry } from '../utils/fieldTypeRegistry'
import { findThemeWidget, themeWidgetDocument } from '../rendering/themeWidgets'
import { validateWidgetConfiguration } from '../api/widgetSchemas'

const Session = forwardRef(function ThemeWidgetInstanceSession({ widgetData, theme, onSave, onClose, namespace, context }, ref) {
    const [widget, setWidget] = useState(() => structuredClone(widgetData))
    const [source, setSource] = useState(() => structuredClone(widgetData))
    const [removed, setRemoved] = useState([])
    const [errors, setErrors] = useState({})
    const [ready, setReady] = useState(false)
    const [busy, setBusy] = useState(false)
    const document = themeWidgetDocument(theme)
    const definition = findThemeWidget(document, widget.type, widget.typeVersion ?? widget.type_version)
    useEffect(() => { fieldTypeRegistry.ensureLoaded().then(() => setReady(true)).catch(error => setErrors({ _general: [error.message] })) }, [])
    const changed = JSON.stringify(widget) !== JSON.stringify(source)
    const sourceChanged = JSON.stringify(widgetData) !== JSON.stringify(source)
    const stale = sourceChanged && changed
    const reload = () => {
        setWidget(structuredClone(widgetData))
        setSource(structuredClone(widgetData))
        setRemoved([])
        setErrors({})
    }
    useEffect(() => {
        if (sourceChanged && !changed) {
            setWidget(structuredClone(widgetData))
            setSource(structuredClone(widgetData))
        }
    }, [widgetData, sourceChanged, changed])
    const save = async () => {
        if (!definition || stale || busy) return { saved: false }
        setBusy(true)
        try {
            const validation = await validateWidgetConfiguration(widget.type, widget.config, { themeId: theme.id, typeVersion: widget.typeVersion ?? widget.type_version })
            setErrors(validation.errors || {})
            if (!validation.isValid && !validation.is_valid) return { saved: false }
            const result = await onSave?.({ ...widget, widgetUpdates: { typeVersion: widget.typeVersion ?? widget.type_version } })
            if (result?.saved !== false) onClose?.()
            return result
        } catch (error) { setErrors({ _general: [error.message] }); return { saved: false } }
        finally { setBusy(false) }
    }
    useImperativeHandle(ref, () => ({ saveCurrentWidget: save, getCurrentConfig: () => widget.config, hasUnsavedChanges: () => changed, isSpecialEditorOpen: () => false }))
    const upgrade = () => {
        const release = definition.item.releases.find(candidate => candidate.version === definition.item.active_version)
        const keys = Object.keys(release.schema.properties)
        setRemoved(Object.entries(widget.config).filter(([key]) => !keys.includes(key)))
        setWidget(current => ({ ...current, typeVersion: release.version, config: {
            ...release.defaults, ...Object.fromEntries(Object.entries(current.config).filter(([key]) => keys.includes(key))),
        } }))
        setErrors({})
    }
    return <aside aria-label="Edit theme widget" className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[440px] overflow-auto border-l border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 p-6 space-y-5">
        <div className="flex justify-between gap-3"><h2 className="text-lg font-semibold">{definition?.item.name || 'Missing widget revision'}</h2><button disabled={busy} onClick={onClose} className="border px-3 py-2">Cancel</button></div>
        {stale && <div role="alert"><p>This widget changed elsewhere while you were editing. Your draft has been kept. Reload the latest widget before saving.</p><button disabled={busy} onClick={reload} className="border px-3 py-2">Reload latest widget</button></div>}
        <p className="text-sm">Type version {widget.typeVersion ?? widget.type_version}</p>
        {definition && definition.item.active_version > definition.release.version && <button className="border px-3 py-2" disabled={busy} onClick={upgrade}>Upgrade to version {definition.item.active_version}</button>}
        {removed.length > 0 && <div role="status" className="text-sm"><p>The new version no longer uses these values. Save to apply the upgrade.</p><dl>{removed.map(([key, value]) => <div key={key}><dt className="font-semibold">{key}</dt><dd className="whitespace-pre-wrap break-words">{typeof value === 'string' ? value : JSON.stringify(value)}</dd></div>)}</dl></div>}
        {Object.keys(errors).length > 0 && <div role="alert">{Object.entries(errors).map(([key, messages]) => <p key={key}>{key}: {Array.isArray(messages) ? messages.join(' ') : String(messages)}</p>)}</div>}
        {!definition && <p role="alert">This type revision is missing from the effective theme. Your content has been retained.</p>}
        {definition && ready && Object.entries(definition.release.schema.properties).map(([name, field]) => <SchemaFieldRenderer key={`${definition.release.version}:${name}`} fieldName={name} fieldSchema={field} schema={definition.release.schema} value={widget.config[name]} required={definition.release.schema.required?.includes(name)} disabled={busy} namespace={namespace} context={{ ...context, theme }} validation={errors[name]} onChange={(key, value) => setWidget(current => ({ ...current, config: { ...current.config, [key]: value } }))} />)}
        <button disabled={busy || stale || !definition || !changed} onClick={save} className="border px-3 py-2">{busy ? 'Saving…' : 'Save widget'}</button>
    </aside>
})

export default forwardRef(function ThemeWidgetInstanceEditor(props, ref) {
    const theme = useWidgetTheme(props.pageVersionData?.effectiveTheme || props.webpageData?.effectiveTheme || props.context?.theme)
    if (!props.isOpen || !props.widgetData) return null
    if (!theme) return <aside role="status" className="fixed right-0 top-0 z-50 bg-white p-6">Loading theme…<button onClick={props.onClose}>Cancel</button></aside>
    return <Session {...props} theme={theme} ref={ref} key={props.widgetData.id} />
})
