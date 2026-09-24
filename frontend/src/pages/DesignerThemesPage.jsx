import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Palette, ArrowRight } from 'lucide-react'
import DesignerNavbar from '../components/DesignerNavbar'
import StatusBar from '../components/StatusBar'
import { designerThemesApi } from '../api/designerThemes'

const DesignerThemesPage = () => {
    const [themes, setThemes] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        designerThemesApi.list()
            .then((result) => setThemes(result.results || []))
            .catch((err) => setError(err.message || 'Unable to load Designer themes.'))
            .finally(() => setLoading(false))
    }, [])

    return (
        <div className="fixed inset-0 flex flex-col bg-gray-50">
            <DesignerNavbar />
            <main className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-5xl px-6 py-10">
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-gray-900">Designer themes</h1>
                        <p className="mt-1 text-sm text-gray-600">Open a theme to update its approved visual settings and assets.</p>
                    </div>
                    {loading && <p className="text-gray-600">Loading themes…</p>}
                    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
                    {!loading && !error && themes.length === 0 && (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
                            <Palette className="mx-auto h-10 w-10 text-gray-400" />
                            <h2 className="mt-3 font-semibold text-gray-900">No assigned themes</h2>
                            <p className="mt-1 text-sm text-gray-600">Ask a tenant administrator to assign a theme to your Designer account.</p>
                        </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                        {themes.map((theme) => (
                            <Link key={theme.id} to={`/designer/themes/${theme.id}`} className="group rounded-lg border border-gray-200 bg-white p-5 hover:border-blue-500">
                                <div className="flex items-start justify-between gap-4">
                                    <div><h2 className="font-semibold text-gray-900">{theme.name}</h2><p className="mt-1 line-clamp-2 text-sm text-gray-600">{theme.description || 'No description'}</p></div>
                                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600" />
                                </div>
                                <p className="mt-4 text-xs text-gray-500">Theme version {theme.syncVersion}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            </main>
            <StatusBar customStatusContent={<span>Designer themes</span>} />
        </div>
    )
}

export default DesignerThemesPage
