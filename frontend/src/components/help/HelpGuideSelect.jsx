import { howToDocs } from '../../data/howToDocs'
import { localizeGuide, localizeSection } from '../../utils/howToI18n'
import { getCmsCopyLanguage } from '../../utils/cmsCopy'
import { helpLanguageFor } from '../../utils/cmsLanguage'

export default function HelpGuideSelect({ value, onChange, disabled = false }) {
    const known = howToDocs.some((section) => section.guides.some((guide) => guide.id === value))
    const language = helpLanguageFor(getCmsCopyLanguage())
    return (
        <label>
            Koppla till hjälpartikel
            <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
                <option value="">Ingen hjälpartikel – endast i instruktionsbiblioteket</option>
                {value && !known && <option value={value}>{value} (artikeln finns inte i denna version)</option>}
                {howToDocs.map((section) => (
                    <optgroup key={section.id} label={localizeSection(section, language).title}>
                        {section.guides.map((guide) => <option key={guide.id} value={guide.id}>{localizeGuide(guide, language).title}</option>)}
                    </optgroup>
                ))}
            </select>
            <span className="mt-1 block text-sm font-normal text-gray-500">
                Filmen visas vid artikeln för medlemmar i den här arbetsytan. Du kan ändra kopplingen senare.
            </span>
        </label>
    )
}
