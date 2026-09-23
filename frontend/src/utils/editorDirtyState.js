export const hasUnsavedEditorChanges = (state) => Boolean(
    state?.metadata?.isDirty
    || state?.metadata?.isThemeDirty
    || state?.metadata?.isObjectDirty
)
