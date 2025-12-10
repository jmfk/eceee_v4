import React, { useRef, useEffect, useCallback, memo, useState } from 'react'
import { Table } from 'lucide-react'
import TableWidgetEditor from './TableWidgetEditor'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { useEditorContext } from '../../contexts/unified-data/hooks'
import { OperationTypes } from '../../contexts/unified-data/types/operations'
import { lookupWidget, hasWidgetContentChanged } from '../../utils/widgetUtils'
import { useTheme } from '../../hooks/useTheme'
import ComponentStyleRenderer from '../../components/ComponentStyleRenderer'
import { renderMustache, prepareComponentContext } from '../../utils/mustacheRenderer'

/**
 * EASY Table Widget Component
 * Renders configurable data tables with advanced styling and cell spanning
 */
const TableWidget = memo(({
    config = {},
    mode = 'preview',
    onConfigChange,
    themeId = null,
    widgetId = null,
    slotName = null,
    widgetType = null,
    widgetPath = [],
    nestedParentWidgetId = null,
    nestedParentSlotName = null,
    slotConfig = null,
    context = {},
}) => {
    const { useExternalChanges, publishUpdate, getState } = useUnifiedData();
    const configRef = useRef(config);
    const [, forceRerender] = useState({});
    const setConfig = (newConfig) => {
        configRef.current = newConfig;
    }
    const componentId = `widget-${widgetId}`;
    const contextType = useEditorContext();

    // Get current theme for component styles
    const { currentTheme } = useTheme({ pageId: context?.pageId, enabled: !!context?.pageId });

    useEffect(() => {
        if (!widgetId || !slotName) {
            return;
        }
        const currentState = getState();
        const widget = lookupWidget(currentState, widgetId, slotName, contextType, widgetPath);
        const udcConfig = widget?.config;
        if (udcConfig && hasWidgetContentChanged(configRef.current, udcConfig)) {
            setConfig(udcConfig);
            forceRerender({});
        }
    }, []);

    // Subscribe to external changes
    useExternalChanges(componentId, (state) => {
        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath);
        const newConfig = widget?.config;
        if (newConfig && hasWidgetContentChanged(configRef.current, newConfig)) {
            setConfig(newConfig);
            forceRerender({});
        }
    });

    // Enhanced config change handler with stable references
    const handleConfigChange = useCallback(async (newConfig) => {
        if (JSON.stringify(newConfig) !== JSON.stringify(configRef.current)) {
            setConfig(newConfig);
            publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                config: newConfig,
                widgetPath: widgetPath.length > 0 ? widgetPath : undefined,
                slotName: slotName,
                contextType: contextType,
                ...(nestedParentWidgetId && {
                    parentWidgetId: nestedParentWidgetId,
                    parentSlotName: nestedParentSlotName
                })
            });
        }
    }, [componentId, widgetId, slotName, contextType, publishUpdate, onConfigChange])

    const {
        rows = [],
        caption = '',
        show_borders = true,
        striped_rows = true,
        hover_effect = true,
        responsive = true,
        table_width = 'full',
        css_class = ''
    } = configRef.current

    if (mode === 'editor') {
        return (
            <TableWidgetEditor
                config={configRef.current}
                onChange={handleConfigChange}
                className=""
                slotDimensions={slotConfig?.dimensions}
            />
        )
    }

    if (rows.length === 0) {
        return (
            <div className="table-widget">
                <div className="bg-gray-200 h-24 rounded flex items-center justify-center text-gray-500">
                    <Table className="h-8 w-8 mr-2" />
                    No table data
                </div>
            </div>
        )
    }

    // Check if using component style with Mustache template
    const componentStyle = configRef.current.componentStyle || configRef.current.component_style || 'default';
    const useCustomStyle = componentStyle && componentStyle !== 'default' && currentTheme?.componentStyles;

    if (useCustomStyle) {
        const style = currentTheme.componentStyles[componentStyle];

        if (style) {
            try {
                // Check for passthru mode
                const isPassthru = style.template?.trim() === '{{passthru}}';

                if (!isPassthru) {
                    // Prepare context for Mustache rendering
                    const mustacheContext = prepareComponentContext(
                        '', // No content for table
                        caption || '',
                        style.variables || {},
                        configRef.current
                    );

                    // Add table specific context
                    mustacheContext.rows = rows;
                    mustacheContext.caption = caption;

                    // Use ComponentStyleRenderer for consistent scoped rendering
                    const styleId = `table-${widgetId || 'preview'}-${componentStyle}`;

                    return (
                        <ComponentStyleRenderer
                            template={style.template}
                            context={mustacheContext}
                            css={style.css}
                            styleId={styleId}
                            className=""
                        />
                    );
                }

                // Passthru mode: render default with custom CSS
                const styleId = `table-${widgetId || 'preview'}-${componentStyle}`;

                return (
                    <div data-style-id={styleId}>
                        {style.css && <style>{`[data-style-id="${styleId}"] { ${style.css} }`}</style>}
                        {renderDefaultTable()}
                    </div>
                );
            } catch (error) {
                console.error('Error rendering custom component style:', error);
                return (
                    <div>
                        <div className="text-red-500 text-sm p-2">Error rendering custom style</div>
                    </div>
                );
            }
        }
    }

    // Default rendering helper function
    function renderDefaultTable() {
        return (
            <div className={`table-widget ${responsive ? 'overflow-x-auto' : ''}`}>
                <table className={`border-collapse ${table_width === 'full' ? 'w-full' : 'w-auto'} ${show_borders ? 'border border-gray-300' : ''} ${css_class}`}>
                    {caption && (
                        <caption className="text-sm font-medium text-gray-700 mb-2">{caption}</caption>
                    )}
                    <tbody>
                        {rows.map((row, rowIndex) => (
                            <tr key={rowIndex}
                                className={`
                                    ${row.is_header ? 'bg-gray-100 font-semibold' : ''} 
                                    ${striped_rows && !row.is_header && rowIndex % 2 === 1 ? 'bg-gray-50' : ''} 
                                    ${hover_effect ? 'hover:bg-gray-100' : ''}
                                    ${row.css_class || ''}
                                `}
                                style={row.background_color ? { backgroundColor: row.background_color } : {}}>
                                {row.cells?.map((cell, cellIndex) => {
                                    const CellTag = row.is_header ? 'th' : 'td'
                                    return (
                                        <CellTag
                                            key={cellIndex}
                                            colSpan={cell.colspan > 1 ? cell.colspan : undefined}
                                            rowSpan={cell.rowspan > 1 ? cell.rowspan : undefined}
                                            className={`
                                                ${show_borders ? 'border border-gray-300' : ''}
                                                px-3 py-2 text-${cell.alignment || 'left'}
                                                ${cell.font_weight === 'bold' ? 'font-bold' : ''}
                                                ${cell.font_style === 'italic' ? 'italic' : ''}
                                                ${cell.css_class || ''}
                                            `}
                                            style={{
                                                backgroundColor: cell.background_color,
                                                color: cell.text_color,
                                                padding: cell.padding,
                                                border: cell.border
                                            }}
                                        >
                                            <div dangerouslySetInnerHTML={{ __html: cell.content || '' }} />
                                        </CellTag>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    // Render the default table
    return renderDefaultTable()
}, (prevProps, nextProps) => {
    // Custom comparison to prevent re-renders when only object references change
    return (
        JSON.stringify(prevProps.config) === JSON.stringify(nextProps.config) &&
        prevProps.mode === nextProps.mode &&
        prevProps.themeId === nextProps.themeId &&
        prevProps.widgetId === nextProps.widgetId &&
        prevProps.slotName === nextProps.slotName &&
        prevProps.widgetType === nextProps.widgetType
    );
})

// === COLOCATED METADATA ===
TableWidget.displayName = 'eceee TableWidget'
TableWidget.widgetType = 'easy_widgets.TableWidget'

// Default configuration
TableWidget.defaultConfig = {
    rows: [
        {
            is_header: true,
            cells: [
                { content: 'Header 1', alignment: 'left' },
                { content: 'Header 2', alignment: 'left' },
                { content: 'Header 3', alignment: 'left' }
            ]
        },
        {
            is_header: false,
            cells: [
                { content: 'Cell 1', alignment: 'left' },
                { content: 'Cell 2', alignment: 'left' },
                { content: 'Cell 3', alignment: 'left' }
            ]
        }
    ],
    caption: '',
    show_borders: true,
    striped_rows: true,
    hover_effect: true,
    responsive: true,
    table_width: 'full'
}

// Display metadata
TableWidget.metadata = {
    name: 'Table',
    description: 'Configurable data tables with advanced styling, cell spanning, and responsive design',
    category: 'data',
    icon: Table,
    tags: ['eceee', 'table', 'data', 'grid', 'spreadsheet', 'rows', 'columns']
}

export default TableWidget
