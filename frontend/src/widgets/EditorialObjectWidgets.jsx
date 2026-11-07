import React from 'react'
import { List, FileText } from 'lucide-react'

// Editors describe dynamic content; Preview resolves the published URL selection.
const ObjectListWidget = ({ config = {} }) => <div className="p-6 text-sm text-gray-600">
    <strong>{config.displayTemplate === 'columnists' ? 'Columnists' : config.displayTemplate === 'events' ? 'Events' : 'Object list'}</strong>
    <p>Published content. Open Preview to see the list and its links.</p>
</div>
ObjectListWidget.displayName = 'Object List'
ObjectListWidget.widgetType = 'object_storage.ObjectListWidget'
ObjectListWidget.defaultConfig = { objectType: 'columnist', displayTemplate: 'columnists', limit: 1000 }
ObjectListWidget.metadata = { name: 'Object List', description: 'Published columnist, event or general object directory.', category: 'content', icon: List, tags: ['columnists', 'events', 'objects'], menuItems: [] }
const ObjectDetailWidget = () => <div className="p-6 text-sm text-gray-600"><strong>Object Detail</strong><p>Shows the published profile or event selected by the page URL. Open Preview to see its content.</p></div>
ObjectDetailWidget.displayName = 'Object Detail'
ObjectDetailWidget.widgetType = 'object_storage.ObjectDetailWidget'
ObjectDetailWidget.defaultConfig = { displayTemplate: 'columnists', objectType: 'columnist', showWidgets: true }
ObjectDetailWidget.metadata = { name: 'Object Detail', description: 'A published profile, event or object selected by URL.', category: 'content', icon: FileText, tags: ['columnists', 'events', 'detail'], menuItems: [] }
export { ObjectListWidget, ObjectDetailWidget }
