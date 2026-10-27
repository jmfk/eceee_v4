import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, History } from 'lucide-react'
import { api } from '../api/client'
import { endpoints } from '../api/endpoints'
import { layoutsApi } from '../api'
import { objectVersionsApi } from '../api/objectStorage'
import { taxonomyApi } from '../api/taxonomy'
import { processLoadedVersionData, mergeVersionedPageAttributes } from '../utils/smartSaveUtils'
import PageContentEditor from '../editors/page-editor/PageContentEditor'
import ObjectWidgetFactory from '../editors/object-editor/ObjectWidgetFactory'
import EditorAccordion from './objectEdit/EditorAccordion'

const ReadOnlyShell = ({ versionNumber, onClose, children }) => <div className="flex h-full min-h-0 flex-col bg-gray-50">
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-blue-200 bg-blue-50 px-5 py-3 text-sm text-blue-900" role="status">
        <span className="flex items-center gap-2"><History className="h-4 w-4" />Viewing version {versionNumber} · Read only</span>
        <button type="button" onClick={onClose} className="flex items-center gap-1 rounded border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-blue-100"><ArrowLeft className="h-3.5 w-3.5" />Back to history</button>
    </div>
    <div className="min-h-0 flex-1 overflow-auto">{children}</div>
</div>

const LoadState = ({ query }) => query.isPending
    ? <p role="status" className="p-6 text-sm text-gray-600">Loading historical version…</p>
    : <p role="alert" className="p-6 text-sm text-red-700">Couldn’t load the historical version. <button type="button" onClick={() => query.refetch()} className="underline">Retry</button></p>

const readOnlyInteraction = {
    onFocusCapture: event => event.target.blur(),
    onClickCapture: event => event.preventDefault(),
    onKeyDownCapture: event => { if (event.key === 'Enter' || event.key === ' ') event.preventDefault() },
}

export function HistoricalPageView({ pageId, versionId, webpageData, namespace, onClose }) {
    const versionQuery = useQuery({
        queryKey: ['historicalPageVersion', pageId, versionId],
        queryFn: async () => {
            const response = await api.get(endpoints.versions.pageVersionDetail(pageId, versionId))
            return processLoadedVersionData(response.data || response)
        },
    })
    const version = versionQuery.data
    const layoutQuery = useQuery({
        queryKey: ['historicalPageLayout', version?.codeLayout],
        queryFn: async () => await layoutsApi.getJson(version.codeLayout),
        enabled: Boolean(version?.codeLayout),
    })
    if (!version) return <LoadState query={versionQuery} />
    const historicalPage = mergeVersionedPageAttributes(webpageData, version)
    return <ReadOnlyShell versionNumber={version.versionNumber} onClose={onClose}>
        <div className="border-b border-gray-200 bg-white px-6 py-4">
            <h1 className="text-lg font-semibold text-gray-900">{historicalPage.title || version.versionTitle || 'Untitled page'}</h1>
            <p className="text-xs text-gray-500">/{historicalPage.slug || ''}</p>
        </div>
        {version.codeLayout && layoutQuery.isPending && <p role="status" className="p-6 text-sm text-gray-600">Loading layout…</p>}
        {layoutQuery.isError && <p role="alert" className="p-6 text-sm text-red-700">The historical layout could not be loaded.</p>}
        {(!version.codeLayout || layoutQuery.isSuccess) && <div {...readOnlyInteraction} className="pointer-events-none" aria-label="Historical page content, read only">
            <PageContentEditor key={versionId} webpageData={historicalPage} pageVersionData={version}
                layoutJson={layoutQuery.data} localWidgets={version.widgets || {}} editable={false}
                alwaysShowEditorControls={false} namespace={namespace} context={{ pageId, mode: 'preview' }} />
        </div>}
    </ReadOnlyShell>
}

const displayValue = value => {
    if (value == null || value === '') return '—'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (Array.isArray(value)) return value.map(displayValue).join(', ') || '—'
    if (typeof value === 'object') return value.title || value.name || value.label || Object.values(value).map(displayValue).join(', ')
    return String(value)
}

export function HistoricalObjectView({ versionId, objectType, onClose }) {
    const versionQuery = useQuery({
        queryKey: ['historicalObjectVersion', versionId],
        queryFn: async () => (await objectVersionsApi.get(versionId)).data,
    })
    const version = versionQuery.data
    const tagsQuery = useQuery({
        queryKey: ['historicalObjectTags', versionId, version?.classificationIds],
        queryFn: async () => await Promise.all(version.classificationIds.map(async id => await taxonomyApi.term(id))),
        enabled: Boolean(version?.classificationIds?.length),
    })
    if (!version) return <LoadState query={versionQuery} />
    const schema = objectType?.schema || {}
    const keys = [...new Set([...(schema.propertyOrder || []), ...Object.keys(schema.properties || {}), ...Object.keys(version.data || {})])]
        .filter(key => key !== 'title')
    const currentSlots = objectType?.slotConfiguration?.slots || []
    const savedSlotNames = Object.keys(version.widgets || {})
    const slots = [...currentSlots, ...savedSlotNames.filter(name => !currentSlots.some(slot => slot.name === name)).map(name => ({ name }))]
    return <ReadOnlyShell versionNumber={version.versionNumber} onClose={onClose}>
        <div className="border-b border-gray-200 bg-white px-6 py-4"><h1 className="text-lg font-semibold text-gray-900">{version.title || 'Untitled object'}</h1></div>
        <div className="flex min-h-full flex-col bg-white lg:flex-row">
            <div className="min-w-0 flex-1 space-y-6 p-6" aria-label="Historical object content">
                {slots.map(slot => <section key={slot.name} className="border border-gray-200 p-4">
                    <h2 className="mb-3 text-sm font-medium text-gray-800">{slot.label || slot.name}</h2>
                    <div {...readOnlyInteraction} className="pointer-events-none space-y-3" aria-label={`${slot.label || slot.name}, read only`}>
                        {(version.widgets?.[slot.name] || []).map((widget, index) => <ObjectWidgetFactory key={widget.id || index}
                            widget={widget} slotName={slot.name} index={index} objectType={objectType}
                            slotConfig={slot} mode="preview" showControls={false} context={{ contextType: 'object', instanceId: version.objectId }} />)}
                    </div>
                </section>)}
            </div>
            <aside className="w-full shrink-0 border-t border-gray-200 lg:w-[420px] lg:border-l lg:border-t-0" aria-label="Historical object properties">
                <EditorAccordion title="Properties" defaultOpen>
                    <dl className="space-y-4 text-sm">{keys.map(key => <div key={key}>
                        <dt className="text-xs font-medium text-gray-500">{schema.properties?.[key]?.title || schema.properties?.[key]?.label || key}</dt>
                        <dd className="mt-1 whitespace-pre-wrap break-words text-gray-900">{displayValue(version.data?.[key])}</dd>
                    </div>)}</dl>
                </EditorAccordion>
                <EditorAccordion title="Tags">
                    {tagsQuery.isPending && version.classificationIds?.length > 0 && <p role="status" className="text-xs text-gray-500">Loading tags…</p>}
                    <ul className="space-y-2 text-sm text-gray-900">{(tagsQuery.data || []).map(term => <li key={term.id}>{term.path || term.name}</li>)}</ul>
                    {!version.classificationIds?.length && <p className="text-sm text-gray-500">No tags</p>}
                    {tagsQuery.isError && <p role="alert" className="text-xs text-red-700">Couldn’t load historical tags.</p>}
                </EditorAccordion>
            </aside>
        </div>
    </ReadOnlyShell>
}
