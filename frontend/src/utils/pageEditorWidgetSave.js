export async function saveWidgetEditorChanges(updatedWidget, {
    applyWidgetUpdate,
    persistChanges,
    addNotification,
    closeWidgetEditor
}) {
    if (!updatedWidget) {
        return { saved: false, reason: 'missing-widget' }
    }

    applyWidgetUpdate?.(updatedWidget)

    const saveOutcome = await persistChanges?.(updatedWidget)
    if (saveOutcome?.saved === false) {
        return saveOutcome
    }

    addNotification?.(
        `Widget "${updatedWidget.name || updatedWidget.id}" saved successfully`,
        'success'
    )
    closeWidgetEditor?.()

    return saveOutcome || { saved: true }
}
