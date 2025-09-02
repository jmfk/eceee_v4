import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

/**
 * GalleryRenderer - React renderer for Gallery widgets
 * Maintains parity with Django template rendering
 */
const GalleryRenderer = ({ configuration }) => {
  const {
    images = [],
    layout = 'grid',
    columns = 3,
    show_captions = true,
    show_lightbox = true,
    css_class = ''
  } = configuration

  const [selectedImage, setSelectedImage] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Handle lightbox navigation
  const openLightbox = (index) => {
    if (show_lightbox) {
      setSelectedImage(images[index])
      setCurrentIndex(index)
    }
  }

  const closeLightbox = () => {
    setSelectedImage(null)
  }

  const navigateLightbox = (direction) => {
    const newIndex = direction === 'next' 
      ? (currentIndex + 1) % images.length
      : (currentIndex - 1 + images.length) % images.length
    
    setSelectedImage(images[newIndex])
    setCurrentIndex(newIndex)
  }

  // Build layout classes
  const layoutClasses = {
    grid: `grid grid-cols-${columns} gap-4`,
    masonry: 'columns-3 gap-4',
    carousel: 'flex overflow-x-auto gap-4 snap-x',
    list: 'space-y-4'
  }

  const containerClasses = [
    'gallery-widget',
    css_class
  ].filter(Boolean).join(' ')

  if (!images || images.length === 0) {
    return (
      <div className={containerClasses}>
        <div className="text-gray-400 italic p-8 border-2 border-dashed border-gray-300 rounded text-center">
          No images in gallery
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={containerClasses}>
        <div className={layoutClasses[layout] || layoutClasses.grid}>
          {images.map((image, index) => (
            <div
              key={index}
              className={`gallery-item ${
                layout === 'carousel' ? 'flex-shrink-0 snap-center' : ''
              } ${show_lightbox ? 'cursor-pointer' : ''}`}
              onClick={() => openLightbox(index)}
            >
              <figure className="gallery-figure">
                <img
                  src={image.url || '/api/placeholder/300/200'}
                  alt={image.alt || `Gallery image ${index + 1}`}
                  className="gallery-image w-full h-auto rounded-lg shadow-sm hover:shadow-md transition-shadow"
                  loading="lazy"
                />
                {show_captions && image.caption && (
                  <figcaption className="gallery-caption mt-2 text-sm text-gray-600">
                    {image.caption}
                  </figcaption>
                )}
              </figure>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {show_lightbox && selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            onClick={closeLightbox}
            aria-label="Close lightbox"
          >
            <X className="w-8 h-8" />
          </button>

          {images.length > 1 && (
            <>
              <button
                className="absolute left-4 text-white hover:text-gray-300 transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  navigateLightbox('prev')
                }}
                aria-label="Previous image"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>

              <button
                className="absolute right-4 text-white hover:text-gray-300 transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  navigateLightbox('next')
                }}
                aria-label="Next image"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}

          <div 
            className="max-w-5xl max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage.url}
              alt={selectedImage.alt || ''}
              className="max-w-full max-h-screen object-contain"
            />
            {selectedImage.caption && (
              <p className="text-white text-center mt-4">
                {selectedImage.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default GalleryRenderer