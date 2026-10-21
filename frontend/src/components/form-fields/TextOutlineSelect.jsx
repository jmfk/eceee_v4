import { textOutlineOptions } from '../../utils/textOutlineStyles'
import { useTheme } from '../../hooks/useTheme'

export default function TextOutlineSelect({ value = 'none', onChange, label = 'Text outline', context, disabled }) {
    const pageId = context?.pageId
    const { currentTheme } = useTheme({ pageId, enabled: false })
    const styles = currentTheme?.textOutlineStyles || currentTheme?.text_outline_styles || {}
    const options = textOutlineOptions(styles)
    return <label className="block text-sm">{label}<select aria-label={label} disabled={disabled} value={value}
        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        onChange={event => onChange(event.target.value)}>
        {!Object.hasOwn(options, value) && <option value={value}>Missing style</option>}
        {Object.entries(options).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
    </select></label>
}
