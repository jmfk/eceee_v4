/**
 * ECEEE Table Widget
 * 
 * ECEEE-specific implementation of the Table widget.
 * Widget type: eceee_widgets.TableWidget
 */

import React from 'react';
import TableWidget from '../default-widgets/TableWidget';

const eceeeTableWidget = (props) => {
    // Use the default TableWidget component but with eceee_widgets namespace
    return <TableWidget {...props} />;
};

// Widget metadata
eceeeTableWidget.displayName = 'ECEEE Table';
eceeeTableWidget.widgetType = 'eceee_widgets.TableWidget';

eceeeTableWidget.defaultConfig = {
    rows: [
        {
            cells: [
                { content: 'Header 1', alignment: 'left' },
                { content: 'Header 2', alignment: 'left' }
            ],
            is_header: true
        },
        {
            cells: [
                { content: 'Row 1, Cell 1', alignment: 'left' },
                { content: 'Row 1, Cell 2', alignment: 'left' }
            ],
            is_header: false
        }
    ],
    caption: null,
    show_borders: true,
    striped_rows: true,
    hover_effect: true,
    responsive: true,
    table_width: 'full',
    css_class: null
};

eceeeTableWidget.metadata = {
    name: 'ECEEE Table',
    description: 'ECEEE-specific table widget with configurable rows and columns',
    category: 'content',
    icon: null,
    tags: ['table', 'data', 'eceee'],
    menuItems: []
};

export default eceeeTableWidget;

