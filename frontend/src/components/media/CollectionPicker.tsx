import React, { useEffect, useState } from 'react';
import { FolderOpen, Loader2 } from 'lucide-react';
import { mediaCollectionsApi } from '../../api';
import { fetchPaginatedResults } from '../../utils/fetchPaginatedResults';
import CollectionThumbnailGrid from './CollectionThumbnailGrid';
import MediaSearchWidget from './MediaSearchWidget';
import { collectionEditorUrl, type PickerCollection } from './collectionEditorUrl';

type SearchTerm = { type: 'text' | 'tag'; value: string };

type CollectionPickerProps = {
    namespace?: string;
    selectedId?: string | null;
    onSelect: (collection: PickerCollection) => void;
};

const CollectionPicker = ({ namespace, selectedId, onSelect }: CollectionPickerProps) => {
    const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([]);
    const [collections, setCollections] = useState<PickerCollection[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [showEmptyCollections, setShowEmptyCollections] = useState(false);

    const emptyCollectionCount = collections.filter(collection =>
        (collection.fileCount ?? collection.file_count ?? 0) === 0
    ).length;
    const visibleCollections = showEmptyCollections
        ? collections
        : collections.filter(collection => (collection.fileCount ?? collection.file_count ?? 0) > 0);

    useEffect(() => {
        if (!namespace) return;
        let active = true;
        const load = async () => {
            setLoading(true);
            setError(false);
            const text = searchTerms.find(term => term.type === 'text')?.value;
            const tagNames = searchTerms.filter(term => term.type === 'tag').map(term => term.value);
            try {
                const results = await fetchPaginatedResults(async page => {
                    const request = await mediaCollectionsApi.list({
                        namespace, page, search: text, tag_names: tagNames,
                    });
                    return await request();
                });
                if (active) setCollections(results);
            } catch (loadError) {
                console.error('Failed to load collections:', loadError);
                if (active) {
                    setCollections([]);
                    setError(true);
                }
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => { active = false; };
    }, [namespace, searchTerms]);

    return (
        <div>
            <div className="mb-4">
                <MediaSearchWidget
                    searchTerms={searchTerms}
                    onChange={setSearchTerms}
                    namespace={namespace}
                    placeholder="Search collections by name or tags..."
                />
            </div>
            <label className="mb-4 inline-flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                    type="checkbox"
                    checked={showEmptyCollections}
                    onChange={event => setShowEmptyCollections(event.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                />
                Show empty collections{emptyCollectionCount > 0 ? ` (${emptyCollectionCount})` : ''}
            </label>
            {loading ? (
                <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>
            ) : error ? (
                <div className="text-center text-red-700 py-12">Could not load collections.</div>
            ) : visibleCollections.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                    <FolderOpen className="w-12 h-12 text-gray-400 mb-3" />
                    {collections.length > 0 && !showEmptyCollections
                        ? 'Empty collections are hidden.'
                        : searchTerms.length ? 'No collections match your search.' : 'No collections found'}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {visibleCollections.map(collection => (
                        <div key={collection.id} className={`border rounded overflow-hidden ${selectedId === collection.id ? 'border-blue-600' : 'border-gray-200'}`}>
                            <button
                                type="button"
                                onClick={() => onSelect(collection)}
                                aria-pressed={selectedId === collection.id}
                                className="block w-full text-left hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                            >
                                <CollectionThumbnailGrid collection={collection} className="aspect-square" />
                                <span className="block px-3 pt-2 text-sm font-medium text-gray-900 truncate">{collection.title}</span>
                                <span className="block px-3 pb-2 text-xs text-gray-600">{collection.fileCount ?? collection.file_count ?? 0} images</span>
                            </button>
                            <a
                                href={collectionEditorUrl(collection, namespace)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block px-3 py-2 border-t border-gray-200 text-xs text-blue-700 underline hover:bg-gray-50"
                            >
                                Edit collection
                            </a>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CollectionPicker;
