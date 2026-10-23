import { useEffect, useState } from 'react'
import client from '../api/client'
import { getCurrentTenantId } from '../utils/tenant'

export default function Avatar({ userId, name = '', size = 28, revision = 0 }) {
    const [url, setUrl] = useState('')
    const tenant = getCurrentTenantId()
    useEffect(() => {
        let active = true, objectUrl
        setUrl('')
        if (userId) client.get(`/api/v1/utils/profile-photos/${userId}/`, { responseType: 'blob', headers: tenant ? { 'X-Tenant-ID': tenant } : {} })
            .then(({ data }) => {
                if (!active || !data.size) return
                objectUrl = URL.createObjectURL(data)
                setUrl(objectUrl)
            }).catch(() => {})
        return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
    }, [userId, tenant, revision])
    return url ? <img src={url} alt={name} width={size} height={size} style={{ width: size, height: size, objectFit: 'cover', borderRadius: '50%', flexShrink: 0 }} />
        : <span role="img" aria-label={name || 'Profilbild'} style={{ width: size, height: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-gray-200, #e5e7eb)', fontSize: size > 40 ? 24 : 11, flexShrink: 0 }}>{name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
}
