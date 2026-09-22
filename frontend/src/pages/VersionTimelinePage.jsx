import { Navigate, useParams } from 'react-router-dom'

const VersionTimelinePage = () => {
    const { pageId } = useParams()
    return <Navigate to={`/pages/${pageId}/edit/publishing?panel=history`} replace />
}

export default VersionTimelinePage
