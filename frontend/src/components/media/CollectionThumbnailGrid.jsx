/**
 * CollectionThumbnailGrid Component
 * Renders a grid of tiny thumbnails from a collection's sample images
 * Matches the logic from MediaCollectionManager
 */
import React from 'react';
import { FolderOpen } from 'lucide-react';
import OptimizedImage from './OptimizedImage';
import { getGridStyle } from '../../utils/imageGridLayout';

const CollectionThumbnailGrid = ({ collection, className = '', compact = false }) => {
    // Helper function to determine grid layout based on file count
    const getGridLayout = (fileCount) => {
        if (fileCount === 1) return { cols: 1, rows: 1, maxImages: 1 };
        if (fileCount <= 6) return { cols: 3, rows: 2, maxImages: 6 };
        if (fileCount <= 12) return { cols: 4, rows: 3, maxImages: 12 };
        return { cols: 6, rows: 4, maxImages: 24 };
    };

    // Helper function to get image files from collection
    const getImageFiles = (collection) => {
        const samples = collection.sampleImages || collection.sample_images || collection.files;
        if (!Array.isArray(samples)) return [];
        const layout = compact && samples.length > 1
            ? { maxImages: 4 }
            : getGridLayout(collection.fileCount || collection.file_count || samples.length);
        return samples.slice(0, layout.maxImages);
    };

    const fileCount = collection.fileCount || collection.file_count || 0;
    const imageFiles = getImageFiles(collection);
    const layout = compact && imageFiles.length > 1
        ? { cols: 2, rows: 2, maxImages: 4 }
        : getGridLayout(fileCount || imageFiles.length);

    if (imageFiles.length === 0) {
        return (
            <div className={`bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center ${className}`}>
                <FolderOpen className="w-8 h-8 text-gray-400" />
            </div>
        );
    }

    // Fill empty slots with repeated images if we have fewer images than grid slots
    const filledImages = [];
    for (let i = 0; i < layout.maxImages; i++) {
        if (imageFiles[i]) {
            filledImages.push(imageFiles[i]);
        } else if (imageFiles.length > 0) {
            filledImages.push(imageFiles[i % imageFiles.length]);
        }
    }

    return (
        <div className={`overflow-hidden bg-gray-100 ${className}`}>
            <div
                className="h-full w-full"
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                    gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
                    gridAutoFlow: 'dense',
                    gap: '1px'
                }}
            >
                {filledImages.map((file, index) => {
                    const gridStyle = getGridStyle(file);
                    
                    return (
                        <div 
                            key={`${file.id}-${index}`} 
                            className="relative overflow-hidden bg-gray-200"
                            style={gridStyle}
                        >
                            <OptimizedImage
                                src={file.imgproxyBaseUrl || file.imgproxy_base_url || file.fileUrl || file.file_url || file.url}
                                alt=""
                                width={100}
                                height={100}
                                resizeType="fit"
                                fillContainer
                                focalPoint={file.focalPoint || file.focal_point || { x: 0.5, y: 0.5 }}
                                className="w-full h-full object-cover"
                                fallback={
                                    <div className="w-full h-full bg-gray-200" />
                                }
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CollectionThumbnailGrid;

