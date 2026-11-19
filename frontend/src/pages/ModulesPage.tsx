import React from 'react'
import { Package } from 'lucide-react'
import { ModuleWorkspace } from '../components/modules/ModuleWorkspace'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import '../components/user-tools.css'
export default function ModulesPage() {
    useDocumentTitle('Service modules')
    const { user } = useAuth()
    return <div className="container mx-auto px-4 py-6"><div className="mb-4"><div className="flex items-center gap-3 mb-2"><Package className="w-6 h-6 text-blue-600" /><h1 className="text-2xl font-bold text-gray-900">Service modules</h1></div><p className="text-sm text-gray-600">Manage products, customer access and community services for this tenant.</p></div><div className="user-tools-panel"><ModuleWorkspace key={user?.currentWorkspace?.id} admin tenantId={user?.currentWorkspace?.id} /></div></div>
}
