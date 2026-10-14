import { useState } from 'react'
import { useParams } from 'react-router-dom'

import DesignerNavbar from '../components/DesignerNavbar'
import StatusBar from '../components/StatusBar'
import LayoutWorkspacePage from './LayoutWorkspacePage'

const DesignerLayoutWorkspacePage = () => {
    const { themeId } = useParams()
    const [cmsNavigationDisabled, setCmsNavigationDisabled] = useState(false)

    return <div className="fixed inset-0 flex flex-col bg-gray-50">
        <DesignerNavbar cmsNavigationDisabled={cmsNavigationDisabled} />
        <main className="min-h-0 flex-1 overflow-hidden bg-white">
            <LayoutWorkspacePage
                backPath={`/designer/themes/${themeId}`}
                backLabel="Theme Designer"
                documentTitle="Designer - Layout Editor"
                fillAvailableSpace
                onCmsNavigationBlockedChange={setCmsNavigationDisabled}
            />
        </main>
        <StatusBar customStatusContent={<span>Designer · Layout Editor</span>} />
    </div>
}

export default DesignerLayoutWorkspacePage
