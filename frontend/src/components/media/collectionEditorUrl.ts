export type PickerCollection = {
    id: string;
    title: string;
    namespace?: string;
    fileCount?: number;
    file_count?: number;
};

export const collectionEditorUrl = (collection: Pick<PickerCollection, 'id' | 'namespace'>, namespace?: string) => {
    const params = new URLSearchParams({ tab: 'collections', collection: collection.id });
    if (collection.namespace || namespace) params.set('namespace', collection.namespace || namespace);
    return `/media?${params.toString()}`;
};
