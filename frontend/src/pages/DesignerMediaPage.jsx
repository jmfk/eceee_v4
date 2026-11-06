import { useQuery } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router-dom'
import { namespacesApi } from '../api/namespaces'
import DesignerNavbar from '../components/DesignerNavbar'
import MediaBrowser from '../components/media/MediaBrowser'
import StatusBar from '../components/StatusBar'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { canAccessCmsPath } from '../utils/cmsNavigation'
import { getCurrentTenantId } from '../utils/tenant'

export default function DesignerMediaPage() {
    const { user } = useAuth()
    useDocumentTitle('Designer · Media')
    const namespaces = useQuery({
        queryKey: ['designer-media-namespace', getCurrentTenantId()],
        queryFn: async () => await namespacesApi.list({ kind: 'theme_media', include_hidden: true }),
        enabled: Boolean(user?.isDesignerOnly),
    })
    const namespace = (namespaces.data?.results || namespaces.data || [])[0]?.slug

    if (!user?.isDesignerOnly) return <Navigate to={canAccessCmsPath(user, '/media') ? '/media' : '/designer/themes'} replace />

    return <div className="fixed inset-0 flex flex-col bg-gray-50">
        <DesignerNavbar />
        <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="container mx-auto px-4 py-6">
                <h1 className="text-2xl font-bold text-gray-900">Media</h1>
                <p className="mt-1 mb-5 text-sm text-gray-600">Browse the media available for this workspace's themes.</p>
                {namespaces.isPending && <p role="status">Loading media library…</p>}
                {namespaces.isError && <div role="alert" className="text-sm text-red-700">
                    Unable to load the media library. <button type="button" className="underline" onClick={() => namespaces.refetch()}>Retry</button>
                </div>}
                {namespaces.isSuccess && (namespace
                    ? <MediaBrowser key={namespace} namespace={namespace} selectionMode="none" showUploader={false} hideActions />
                    : <div className="py-8 text-center text-sm text-gray-600">
                        <p>No theme media library yet. Open a theme in Designer to get started.</p>
                        <Link to="/designer/themes" className="mt-3 inline-flex rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700">Open Designer</Link>
                    </div>)}
            </div>
        </main>
        <StatusBar customStatusContent={<span>Designer · Media</span>} />
    </div>
}
