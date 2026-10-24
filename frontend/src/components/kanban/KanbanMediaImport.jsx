import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ClassificationPicker from '../classification/ClassificationPicker'
import CompactSelect from '../classification/CompactSelect'
import '../classification/classification.css'
import { taxonomyApi, classificationError } from '../../api/taxonomy'
import { kanbanApi, kanbanError } from '../../api/kanban'
import { useAuth } from '../../contexts/AuthContext'
import { getCurrentTenantId } from '../../utils/tenant'

export default function KanbanMediaImport({ file, revision }) {
    const { user } = useAuth()
    const tenant = getCurrentTenantId()
    const client = useQueryClient()
    const [open, setOpen] = useState(false)
    const [namespace, setNamespace] = useState('')
    const [classificationIds, setClassificationIds] = useState([])
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const namespaces = useQuery({
        queryKey: ['kanban', tenant, user?.id, 'media-import-namespaces'],
        queryFn: async () => await taxonomyApi.namespaces(),
        enabled: open,
    })
    const choices = (namespaces.data?.results || []).filter(item => item.kind === 'content' && !item.isHidden)
    const allowed = !Array.isArray(user?.permissions) || user.isSuperuser || user.permissions.includes('tenant.admin') || user.permissions.includes('media.write')
    if (!file.approvedAt || !allowed) return null
    const importFile = async () => {
        setBusy(true); setError('')
        try {
            await kanbanApi.post(`attachments/${file.id}/import/`, { destination: 'media', revision, namespace: Number(namespace), classificationIds })
            await client.invalidateQueries({ queryKey: ['kanban', tenant] })
            setOpen(false)
        } catch (failure) { setError(kanbanError(failure)) }
        finally { setBusy(false) }
    }
    return <div className="classification-manager mt-2">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>Importera till media</button>
        {open && <div className="mt-3 max-w-xl space-y-3" aria-label={`Mediaimport: ${file.filename}`}>
            <label className="classification-field"><span>Namespace</span>
                <CompactSelect label="Namespace" value={namespace} disabled={busy} onChange={event => { setNamespace(event.target.value); setClassificationIds([]) }}>
                    <option value="">Välj namespace</option>{choices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </CompactSelect>
            </label>
            {namespaces.isPending && <p role="status">Laddar namespaces…</p>}
            {namespaces.error && <p role="alert">{classificationError(namespaces.error)}</p>}
            {namespace && <ClassificationPicker key={namespace} namespace={Number(namespace)} use="media_files" value={classificationIds} onChange={setClassificationIds} disabled={busy} />}
            {error && <p role="alert">{error}</p>}
            <button type="button" className="user-tools-primary" disabled={busy || !namespace || !classificationIds.length} onClick={importFile}>Importera kopia</button>
        </div>}
    </div>
}
