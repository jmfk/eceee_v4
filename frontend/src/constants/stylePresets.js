/**
 * Style Presets Library
 * 
 * Pre-built templates and CSS snippets for Gallery, Carousel, and Component styles.
 * Users can insert these presets into their custom styles for quick setup.
 */

export const STYLE_PRESETS = {
  // ========== LIGHTBOX PRESETS ==========
  'lightbox-modern': {
    id: 'lightbox-modern',
    name: 'Modern Lightbox',
    description: 'Clean modal overlay with smooth transitions',
    category: 'lightbox',
    template: `<!-- Lightbox Modal -->
<div class="lightbox-modal" id="lightbox-modal" style="display: none;" onclick="closeLightbox(event)">
  <div class="lightbox-content">
    <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
    <div class="lightbox-image-container">
      <img id="lightbox-image" src="" alt="" class="lightbox-image">
      <button class="lightbox-btn lightbox-prev" onclick="lightboxChangeSlide(-1)">
        <span aria-hidden="true">‹</span>
      </button>
      <button class="lightbox-btn lightbox-next" onclick="lightboxChangeSlide(1)">
        <span aria-hidden="true">›</span>
      </button>
    </div>
    <div class="lightbox-info" id="lightbox-info">
      <h3 id="lightbox-caption"></h3>
      <p id="lightbox-description"></p>
    </div>
    <div class="lightbox-counter" id="lightbox-counter"></div>
  </div>
</div>`,
    css: `.lightbox-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.lightbox-modal[style*="display: flex"] {
  opacity: 1;
}
.lightbox-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.lightbox-image-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lightbox-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}
.lightbox-close {
  position: absolute;
  top: -3rem;
  right: 0;
  background: none;
  border: none;
  color: white;
  font-size: 3rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.5rem;
  transition: transform 0.2s;
}
.lightbox-close:hover {
  transform: scale(1.1);
}
.lightbox-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 2rem;
  color: #333;
  transition: background-color 0.2s;
}
.lightbox-btn:hover {
  background: white;
}
.lightbox-prev { left: -4rem; }
.lightbox-next { right: -4rem; }
.lightbox-info {
  text-align: center;
  color: white;
}
.lightbox-info h3 {
  font-size: 1.25rem;
  margin: 0 0 0.5rem 0;
}
.lightbox-info p {
  font-size: 0.875rem;
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
}
.lightbox-counter {
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
}
@media (max-width: 768px) {
  .lightbox-btn {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1.5rem;
  }
  .lightbox-prev { left: 0.5rem; }
  .lightbox-next { right: 0.5rem; }
  .lightbox-close {
    top: -2rem;
    font-size: 2rem;
  }
}`
  },

  'lightbox-minimal': {
    id: 'lightbox-minimal',
    name: 'Minimal Lightbox',
    description: 'Simple fullscreen lightbox with minimal UI',
    category: 'lightbox',
    template: `<!-- Minimal Lightbox -->
<div class="lightbox-minimal" id="lightbox-modal" style="display: none;">
  <button class="lightbox-close-minimal" onclick="closeLightbox()">✕</button>
  <img id="lightbox-image" src="" alt="" class="lightbox-image-minimal">
  <div class="lightbox-nav-minimal">
    <button onclick="lightboxChangeSlide(-1)">← Prev</button>
    <span id="lightbox-counter"></span>
    <button onclick="lightboxChangeSlide(1)">Next →</button>
  </div>
</div>`,
    css: `.lightbox-minimal {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lightbox-image-minimal {
  max-width: 95%;
  max-height: 95%;
  object-fit: contain;
}
.lightbox-close-minimal {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  font-size: 2rem;
  width: 3rem;
  height: 3rem;
  border-radius: 4px;
  cursor: pointer;
  backdrop-filter: blur(10px);
}
.lightbox-close-minimal:hover {
  background: rgba(255, 255, 255, 0.2);
}
.lightbox-nav-minimal {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2rem;
  align-items: center;
  background: rgba(0, 0, 0, 0.5);
  padding: 1rem 2rem;
  border-radius: 2rem;
  backdrop-filter: blur(10px);
}
.lightbox-nav-minimal button {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.5rem 1rem;
}
.lightbox-nav-minimal button:hover {
  text-decoration: underline;
}
.lightbox-nav-minimal span {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
}`
  },

  'lightbox-fullscreen': {
    id: 'lightbox-fullscreen',
    name: 'Fullscreen Overlay',
    description: 'Immersive fullscreen experience with dark background',
    category: 'lightbox',
    template: `<!-- Fullscreen Lightbox -->
<div class="lightbox-fullscreen" id="lightbox-modal" style="display: none;">
  <div class="lightbox-fs-overlay" onclick="closeLightbox()"></div>
  <div class="lightbox-fs-container">
    <img id="lightbox-image" src="" alt="" class="lightbox-fs-image">
    <div class="lightbox-fs-controls">
      <button class="fs-ctrl-btn" onclick="lightboxChangeSlide(-1)">
        <svg width="24" height="24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
      </button>
      <div class="lightbox-fs-info">
        <p id="lightbox-caption"></p>
        <span id="lightbox-counter"></span>
      </div>
      <button class="fs-ctrl-btn" onclick="lightboxChangeSlide(1)">
        <svg width="24" height="24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
      </button>
    </div>
    <button class="lightbox-fs-close" onclick="closeLightbox()">
      <svg width="24" height="24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
    </button>
  </div>
</div>`,
    css: `.lightbox-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1000;
}
.lightbox-fs-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.98);
}
.lightbox-fs-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem 2rem;
}
.lightbox-fs-image {
  max-width: 100%;
  max-height: calc(100vh - 10rem);
  object-fit: contain;
}
.lightbox-fs-controls {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 3rem;
  background: rgba(255, 255, 255, 0.1);
  padding: 1rem 2rem;
  border-radius: 3rem;
  backdrop-filter: blur(10px);
}
.fs-ctrl-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}
.fs-ctrl-btn:hover {
  opacity: 0.7;
}
.lightbox-fs-info {
  text-align: center;
  color: white;
}
.lightbox-fs-info p {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
}
.lightbox-fs-info span {
  font-size: 0.75rem;
  opacity: 0.7;
}
.lightbox-fs-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  transition: background 0.2s;
}
.lightbox-fs-close:hover {
  background: rgba(255, 255, 255, 0.2);
}`
  },

  // ========== CAROUSEL BUTTON PRESETS ==========
  'carousel-buttons-circular': {
    id: 'carousel-buttons-circular',
    name: 'Circular Buttons',
    description: 'Round buttons with icons, elegant and modern',
    category: 'buttons',
    template: `<button class="carousel-btn-circular carousel-prev" onclick="prevSlide()" aria-label="Previous">
  <svg width="24" height="24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
</button>
<button class="carousel-btn-circular carousel-next" onclick="nextSlide()" aria-label="Next">
  <svg width="24" height="24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
</button>`,
    css: `.carousel-btn-circular {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.95);
  border: none;
  border-radius: 50%;
  width: 3.5rem;
  height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #1f2937;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.2s;
  z-index: 10;
}
.carousel-btn-circular:hover {
  background: white;
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}
.carousel-prev { left: 1rem; }
.carousel-next { right: 1rem; }
@media (max-width: 768px) {
  .carousel-btn-circular {
    width: 2.5rem;
    height: 2.5rem;
  }
  .carousel-btn-circular svg {
    width: 20px;
    height: 20px;
  }
}`
  },

  'carousel-buttons-square': {
    id: 'carousel-buttons-square',
    name: 'Square Buttons',
    description: 'Sharp, minimal square navigation buttons',
    category: 'buttons',
    template: `<button class="carousel-btn-square carousel-prev" onclick="prevSlide()" aria-label="Previous">‹</button>
<button class="carousel-btn-square carousel-next" onclick="nextSlide()" aria-label="Next">›</button>`,
    css: `.carousel-btn-square {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: #1f2937;
  border: none;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: white;
  font-size: 2rem;
  line-height: 1;
  transition: background 0.2s;
  z-index: 10;
}
.carousel-btn-square:hover {
  background: #374151;
}
.carousel-prev { left: 0; }
.carousel-next { right: 0; }`
  },

  'carousel-buttons-minimal': {
    id: 'carousel-buttons-minimal',
    name: 'Minimal Arrows',
    description: 'Subtle arrow buttons that appear on hover',
    category: 'buttons',
    template: `<button class="carousel-btn-minimal carousel-prev" onclick="prevSlide()" aria-label="Previous">←</button>
<button class="carousel-btn-minimal carousel-next" onclick="nextSlide()" aria-label="Next">→</button>`,
    css: `.carousel-btn-minimal {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: white;
  font-size: 3rem;
  cursor: pointer;
  padding: 1rem;
  opacity: 0;
  transition: opacity 0.3s;
  z-index: 10;
}
.carousel-container:hover .carousel-btn-minimal {
  opacity: 0.7;
}
.carousel-btn-minimal:hover {
  opacity: 1;
}
.carousel-prev { left: 0; }
.carousel-next { right: 0; }`
  },

  'carousel-buttons-bold': {
    id: 'carousel-buttons-bold',
    name: 'Bold with Background',
    description: 'Large buttons with colored background bars',
    category: 'buttons',
    template: `<button class="carousel-btn-bold carousel-prev" onclick="prevSlide()" aria-label="Previous">
  <span>‹</span>
</button>
<button class="carousel-btn-bold carousel-next" onclick="nextSlide()" aria-label="Next">
  <span>›</span>
</button>`,
    css: `.carousel-btn-bold {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4rem;
  background: linear-gradient(to right, rgba(0,0,0,0.5), transparent);
  border: none;
  color: white;
  font-size: 3rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s;
  z-index: 10;
}
.carousel-btn-bold:hover {
  background: linear-gradient(to right, rgba(0,0,0,0.7), transparent);
}
.carousel-prev {
  left: 0;
  background: linear-gradient(to right, rgba(0,0,0,0.5), transparent);
}
.carousel-next {
  right: 0;
  background: linear-gradient(to left, rgba(0,0,0,0.5), transparent);
}
.carousel-next:hover {
  background: linear-gradient(to left, rgba(0,0,0,0.7), transparent);
}`
  },

  // ========== GALLERY BASE TEMPLATES ==========
  'gallery-classic-grid': {
    id: 'gallery-classic-grid',
    name: 'Classic Grid',
    description: 'Simple responsive grid layout',
    category: 'gallery',
    template: `<div class="gallery-classic">
  {{#images}}
    <div class="gallery-item" data-index="{{index}}">
      <img src="{{url}}" alt="{{alt}}" loading="lazy" 
           {{#enableLightbox}}onclick="openLightbox({{index}})" style="cursor: pointer;"{{/enableLightbox}}>
      {{#showCaptions}}
        {{#caption}}
          <div class="gallery-caption">{{caption}}</div>
        {{/caption}}
      {{/showCaptions}}
    </div>
  {{/images}}
</div>`,
    css: `.gallery-classic {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  padding: 1rem;
}
.gallery-item {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}
.gallery-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}
.gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.gallery-caption {
  padding: 0.75rem;
  background: white;
  font-size: 0.875rem;
  color: #374151;
}
@media (max-width: 768px) {
  .gallery-classic {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
  }
}`
  },

  'gallery-masonry': {
    id: 'gallery-masonry',
    name: 'Masonry Layout',
    description: 'Pinterest-style masonry grid',
    category: 'gallery',
    template: `<div class="gallery-masonry">
  {{#images}}
    <div class="masonry-item" data-index="{{index}}">
      <img src="{{url}}" alt="{{alt}}" loading="lazy"
           {{#enableLightbox}}onclick="openLightbox({{index}})" style="cursor: pointer;"{{/enableLightbox}}>
      {{#showCaptions}}
        {{#caption}}
          <div class="masonry-caption">
            <h4>{{caption}}</h4>
            {{#description}}<p>{{description}}</p>{{/description}}
          </div>
        {{/caption}}
      {{/showCaptions}}
    </div>
  {{/images}}
</div>`,
    css: `.gallery-masonry {
  column-count: 3;
  column-gap: 1rem;
  padding: 1rem;
}
.masonry-item {
  break-inside: avoid;
  margin-bottom: 1rem;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: box-shadow 0.2s;
}
.masonry-item:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}
.masonry-item img {
  width: 100%;
  display: block;
}
.masonry-caption {
  padding: 1rem;
}
.masonry-caption h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  color: #1f2937;
}
.masonry-caption p {
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
}
@media (max-width: 1024px) {
  .gallery-masonry { column-count: 2; }
}
@media (max-width: 640px) {
  .gallery-masonry { column-count: 1; }
}`
  },

  'gallery-hover-overlay': {
    id: 'gallery-hover-overlay',
    name: 'Grid with Hover Overlay',
    description: 'Grid with caption overlay on hover',
    category: 'gallery',
    template: `<div class="gallery-hover">
  {{#images}}
    <div class="hover-item" data-index="{{index}}"
         {{#enableLightbox}}onclick="openLightbox({{index}})" style="cursor: pointer;"{{/enableLightbox}}>
      <img src="{{url}}" alt="{{alt}}" loading="lazy">
      <div class="hover-overlay">
        {{#caption}}<h4>{{caption}}</h4>{{/caption}}
        {{#description}}<p>{{description}}</p>{{/description}}
        <span class="hover-icon">🔍</span>
      </div>
    </div>
  {{/images}}
</div>`,
    css: `.gallery-hover {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  padding: 1rem;
}
.hover-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 12px;
}
.hover-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s;
}
.hover-item:hover img {
  transform: scale(1.1);
}
.hover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 1.5rem;
  opacity: 0;
  transition: opacity 0.3s;
  color: white;
  text-align: center;
}
.hover-item:hover .hover-overlay {
  opacity: 1;
}
.hover-overlay h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
}
.hover-overlay p {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
  opacity: 0.9;
}
.hover-icon {
  font-size: 2rem;
}`
  },

  'gallery-photo-wall': {
    id: 'gallery-photo-wall',
    name: 'Photo Wall',
    description: 'Compact grid with minimal gaps',
    category: 'gallery',
    template: `<div class="gallery-wall">
  {{#images}}
    <div class="wall-photo" data-index="{{index}}"
         {{#enableLightbox}}onclick="openLightbox({{index}})" style="cursor: pointer;"{{/enableLightbox}}>
      <img src="{{url}}" alt="{{alt}}" loading="lazy">
    </div>
  {{/images}}
</div>`,
    css: `.gallery-wall {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 4px;
}
.wall-photo {
  aspect-ratio: 1;
  overflow: hidden;
  position: relative;
}
.wall-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: opacity 0.2s, transform 0.2s;
}
.wall-photo:hover img {
  opacity: 0.9;
  transform: scale(1.05);
}`
  },

  // ========== CAROUSEL BASE TEMPLATES ==========
  'carousel-slide': {
    id: 'carousel-slide',
    name: 'Slide Transition',
    description: 'Classic horizontal slide carousel',
    category: 'carousel',
    template: `<div class="carousel-slide-wrapper" x-data="{ current: 0, total: {{imageCount}} }">
  <div class="carousel-track" :style="'transform: translateX(-' + (current * 100) + '%)'">
    {{#images}}
      <div class="carousel-slide">
        <img src="{{url}}" alt="{{alt}}" loading="lazy">
        {{#showCaptions}}
          {{#caption}}<div class="slide-caption">{{caption}}</div>{{/caption}}
        {{/showCaptions}}
      </div>
    {{/images}}
  </div>
  {{#multipleImages}}
  <button @click="current = (current - 1 + total) % total" class="slide-nav slide-prev">‹</button>
  <button @click="current = (current + 1) % total" class="slide-nav slide-next">›</button>
  <div class="slide-dots">
    <template x-for="i in total" :key="i">
      <button @click="current = i - 1" :class="current === i - 1 ? 'active' : ''" class="slide-dot"></button>
    </template>
  </div>
  {{/multipleImages}}
</div>`,
    css: `.carousel-slide-wrapper {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  background: #000;
}
.carousel-track {
  display: flex;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
.carousel-slide {
  min-width: 100%;
  position: relative;
}
.carousel-slide img {
  width: 100%;
  height: 500px;
  object-fit: cover;
  display: block;
}
.slide-caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  color: white;
  padding: 2rem 1.5rem 1.5rem;
  font-size: 1.125rem;
}
.slide-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.9);
  border: none;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  font-size: 2rem;
  cursor: pointer;
  z-index: 10;
  transition: background 0.2s;
}
.slide-nav:hover {
  background: white;
}
.slide-prev { left: 1rem; }
.slide-next { right: 1rem; }
.slide-dots {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
  z-index: 10;
}
.slide-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  background: rgba(255,255,255,0.5);
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}
.slide-dot.active {
  background: white;
}
@media (max-width: 768px) {
  .carousel-slide img { height: 300px; }
}`
  },

  'carousel-fade': {
    id: 'carousel-fade',
    name: 'Fade Transition',
    description: 'Smooth fade between images',
    category: 'carousel',
    template: `<div class="carousel-fade-wrapper" x-data="{ current: 0, total: {{imageCount}} }">
  <div class="fade-container">
    {{#images}}
      <div class="fade-slide" :class="current === {{index}} ? 'active' : ''">
        <img src="{{url}}" alt="{{alt}}" loading="lazy">
      </div>
    {{/images}}
  </div>
  {{#multipleImages}}
  <button @click="current = (current - 1 + total) % total" class="fade-nav fade-prev">←</button>
  <button @click="current = (current + 1) % total" class="fade-nav fade-next">→</button>
  {{/multipleImages}}
</div>`,
    css: `.carousel-fade-wrapper {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
}
.fade-container {
  position: relative;
  aspect-ratio: 16 / 9;
}
.fade-slide {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.6s ease-in-out;
  pointer-events: none;
}
.fade-slide.active {
  opacity: 1;
  pointer-events: auto;
}
.fade-slide img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.fade-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0,0,0,0.5);
  border: none;
  color: white;
  width: 3rem;
  height: 3rem;
  border-radius: 4px;
  font-size: 1.5rem;
  cursor: pointer;
  backdrop-filter: blur(5px);
  transition: background 0.2s;
  z-index: 10;
}
.fade-nav:hover {
  background: rgba(0,0,0,0.7);
}
.fade-prev { left: 1rem; }
.fade-next { right: 1rem; }`
  },

  'carousel-card-slider': {
    id: 'carousel-card-slider',
    name: 'Card Slider',
    description: 'Cards with peek at next/prev items',
    category: 'carousel',
    template: `<div class="carousel-cards" x-data="{ current: 0, total: {{imageCount}} }">
  <div class="cards-track" :style="'transform: translateX(calc(-' + current + ' * (100% + 1rem)))'">
    {{#images}}
      <div class="card-slide">
        <img src="{{url}}" alt="{{alt}}" loading="lazy">
        {{#caption}}<div class="card-info"><h4>{{caption}}</h4></div>{{/caption}}
      </div>
    {{/images}}
  </div>
  {{#multipleImages}}
  <button @click="current = Math.max(0, current - 1)" class="cards-nav cards-prev">‹</button>
  <button @click="current = Math.min(total - 1, current + 1)" class="cards-nav cards-next">›</button>
  {{/multipleImages}}
</div>`,
    css: `.carousel-cards {
  position: relative;
  padding: 2rem 4rem;
  overflow: hidden;
}
.cards-track {
  display: flex;
  gap: 1rem;
  transition: transform 0.4s ease;
}
.card-slide {
  min-width: calc(100% - 8rem);
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}
.card-slide img {
  width: 100%;
  height: 400px;
  object-fit: cover;
  display: block;
}
.card-info {
  padding: 1.5rem;
}
.card-info h4 {
  margin: 0;
  font-size: 1.25rem;
  color: #1f2937;
}
.cards-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: white;
  border: 1px solid #e5e7eb;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  font-size: 2rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: all 0.2s;
  z-index: 10;
}
.cards-nav:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transform: translateY(-50%) scale(1.05);
}
.cards-prev { left: 0; }
.cards-next { right: 0; }
@media (max-width: 768px) {
  .carousel-cards { padding: 1rem 3rem; }
  .card-slide { min-width: calc(100% - 6rem); }
}`
  },

  'carousel-hero': {
    id: 'carousel-hero',
    name: 'Full-Width Hero',
    description: 'Large hero carousel with text overlay',
    category: 'carousel',
    template: `<div class="carousel-hero" x-data="{ current: 0, total: {{imageCount}} }">
  <div class="hero-track" :style="'transform: translateX(-' + (current * 100) + '%)'">
    {{#images}}
      <div class="hero-slide">
        <img src="{{url}}" alt="{{alt}}" loading="lazy">
        <div class="hero-content">
          {{#caption}}<h2>{{caption}}</h2>{{/caption}}
          {{#description}}<p>{{description}}</p>{{/description}}
        </div>
      </div>
    {{/images}}
  </div>
  {{#multipleImages}}
  <div class="hero-controls">
    <button @click="current = (current - 1 + total) % total" class="hero-btn">← Previous</button>
    <div class="hero-indicators">
      <template x-for="i in total" :key="i">
        <span @click="current = i - 1" :class="current === i - 1 ? 'active' : ''" class="hero-indicator"></span>
      </template>
    </div>
    <button @click="current = (current + 1) % total" class="hero-btn">Next →</button>
  </div>
  {{/multipleImages}}
</div>`,
    css: `.carousel-hero {
  position: relative;
  width: 100%;
  overflow: hidden;
}
.hero-track {
  display: flex;
  transition: transform 0.6s ease;
}
.hero-slide {
  min-width: 100%;
  position: relative;
  height: 600px;
}
.hero-slide img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.hero-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.4);
  color: white;
  text-align: center;
  padding: 2rem;
}
.hero-content h2 {
  font-size: 3rem;
  margin: 0 0 1rem 0;
  font-weight: 700;
  text-shadow: 0 2px 10px rgba(0,0,0,0.3);
}
.hero-content p {
  font-size: 1.25rem;
  margin: 0;
  max-width: 600px;
  text-shadow: 0 1px 5px rgba(0,0,0,0.3);
}
.hero-controls {
  position: absolute;
  bottom: 2rem;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  padding: 0 2rem;
}
.hero-btn {
  background: rgba(255,255,255,0.2);
  border: 2px solid white;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 2rem;
  cursor: pointer;
  font-size: 1rem;
  backdrop-filter: blur(10px);
  transition: background 0.2s;
}
.hero-btn:hover {
  background: rgba(255,255,255,0.3);
}
.hero-indicators {
  display: flex;
  gap: 0.75rem;
}
.hero-indicator {
  width: 3rem;
  height: 4px;
  background: rgba(255,255,255,0.5);
  cursor: pointer;
  border-radius: 2px;
  transition: background 0.2s;
}
.hero-indicator.active {
  background: white;
}
@media (max-width: 768px) {
  .hero-slide { height: 400px; }
  .hero-content h2 { font-size: 2rem; }
  .hero-content p { font-size: 1rem; }
}`
  },

  // ========== COMPONENT TEMPLATES ==========
  'component-banner': {
    id: 'component-banner',
    name: 'Banner',
    description: 'Eye-catching gradient banner',
    category: 'component',
    template: `<div class="component-banner">
  <div class="banner-content">
    {{{content}}}
  </div>
</div>`,
    css: `.component-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 3rem 2rem;
  margin: 2rem 0;
  border-radius: 12px;
  text-align: center;
}
.banner-content h1, 
.banner-content h2, 
.banner-content h3 {
  margin-top: 0;
  color: white;
}
.banner-content p {
  font-size: 1.125rem;
  opacity: 0.95;
}`
  },

  'component-alert': {
    id: 'component-alert',
    name: 'Alert Box',
    description: 'Styled notification box with icon',
    category: 'component',
    template: `<div class="component-alert">
  <div class="alert-icon">ℹ️</div>
  <div class="alert-content">
    {{{content}}}
  </div>
</div>`,
    css: `.component-alert {
  display: flex;
  gap: 1rem;
  background: #eff6ff;
  border-left: 4px solid #3b82f6;
  padding: 1.25rem;
  margin: 1.5rem 0;
  border-radius: 6px;
}
.alert-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}
.alert-content {
  flex: 1;
  color: #1e40af;
}
.alert-content p:first-child {
  margin-top: 0;
}
.alert-content p:last-child {
  margin-bottom: 0;
}`
  },

  'component-featured': {
    id: 'component-featured',
    name: 'Featured Content',
    description: 'Highlighted content box with border',
    category: 'component',
    template: `<div class="component-featured">
  <div class="featured-badge">Featured</div>
  <div class="featured-content">
    {{{content}}}
  </div>
</div>`,
    css: `.component-featured {
  position: relative;
  background: white;
  border: 2px solid #3b82f6;
  padding: 2rem;
  margin: 2rem 0;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.15);
}
.featured-badge {
  position: absolute;
  top: -0.75rem;
  left: 1.5rem;
  background: #3b82f6;
  color: white;
  padding: 0.25rem 1rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
}
.featured-content h1,
.featured-content h2,
.featured-content h3 {
  color: #1e40af;
}`
  },

  'component-highlight': {
    id: 'component-highlight',
    name: 'Highlight Box',
    description: 'Content with colored background',
    category: 'component',
    template: `<div class="component-highlight">
  {{{content}}}
</div>`,
    css: `.component-highlight {
  background: #fef3c7;
  border: 1px solid #fbbf24;
  padding: 1.5rem;
  margin: 1.5rem 0;
  border-radius: 8px;
}
.component-highlight h1,
.component-highlight h2,
.component-highlight h3 {
  color: #92400e;
  margin-top: 0;
}
.component-highlight p {
  color: #78350f;
}`
  },

  // ========== CONTENT WIDGET SCENARIOS ==========
  'content-card': {
    id: 'content-card',
    name: 'Content Card',
    description: 'ContentWidget wrapped in a card with shadow',
    category: 'component',
    template: `<div class="content-card">
  <div class="card-body">
    {{{content}}}
  </div>
</div>`,
    css: `.content-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  margin: 2rem 0;
  border: 1px solid #e5e7eb;
  transition: all 0.3s;
}
.content-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}
.content-card h1,
.content-card h2,
.content-card h3 {
  color: #1f2937;
  border-bottom: 2px solid #3b82f6;
  padding-bottom: 0.5rem;
}
.content-card p {
  color: #4b5563;
  line-height: 1.8;
}`
  },

  'content-bordered-section': {
    id: 'content-bordered-section',
    name: 'Bordered Section',
    description: 'ContentWidget with decorative border',
    category: 'component',
    template: `<div class="content-bordered">
  <div class="border-accent"></div>
  <div class="content-body">
    {{{content}}}
  </div>
</div>`,
    css: `.content-bordered {
  position: relative;
  padding: 2rem;
  margin: 2rem 0;
  background: #f9fafb;
  border-radius: 8px;
}
.border-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
  border-radius: 4px 0 0 4px;
}
.content-body {
  padding-left: 1rem;
}
.content-body h2 {
  color: #1f2937;
  margin-top: 0;
}`
  },

  // ========== HERO WIDGET SCENARIOS ==========
  'hero-gradient-overlay': {
    id: 'hero-gradient-overlay',
    name: 'Hero with Gradient Overlay',
    description: 'HeroWidget with gradient overlay on background image',
    category: 'component',
    template: `<div class="hero-gradient">
  {{{content}}}
</div>`,
    css: `.hero-gradient {
  position: relative;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(139, 92, 246, 0.9));
  padding: 6rem 2rem;
  text-align: center;
}
.hero-gradient h1 {
  font-size: 3.5rem;
  font-weight: 800;
  color: white;
  text-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  margin: 0 0 1.5rem 0;
}
.hero-gradient .before-text,
.hero-gradient .after-text {
  color: rgba(255, 255, 255, 0.95);
  font-size: 1.25rem;
}
@media (max-width: 768px) {
  .hero-gradient {
    padding: 4rem 1.5rem;
  }
  .hero-gradient h1 {
    font-size: 2.5rem;
  }
}`
  },

  'hero-split-screen': {
    id: 'hero-split-screen',
    name: 'Split Screen Hero',
    description: 'HeroWidget with split image/content layout',
    category: 'component',
    template: `<div class="hero-split">
  <div class="hero-split-content">
    {{{content}}}
  </div>
</div>`,
    css: `.hero-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 500px;
  overflow: hidden;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}
.hero-split-content {
  padding: 4rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: #1f2937;
  color: white;
}
.hero-split-content h1 {
  font-size: 2.5rem;
  margin: 0 0 1rem 0;
}
.hero-split-content .after-text {
  font-size: 1.125rem;
  opacity: 0.9;
}
@media (max-width: 768px) {
  .hero-split {
    grid-template-columns: 1fr;
  }
  .hero-split-content {
    padding: 3rem 2rem;
  }
}`
  },

  // ========== TABLE WIDGET SCENARIOS ==========
  'table-modern': {
    id: 'table-modern',
    name: 'Modern Table',
    description: 'TableWidget with clean modern styling',
    category: 'component',
    template: `<div class="table-modern-wrapper">
  {{{content}}}
</div>`,
    css: `.table-modern-wrapper table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.table-modern-wrapper th {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.table-modern-wrapper td {
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
}
.table-modern-wrapper tr:last-child td {
  border-bottom: none;
}
.table-modern-wrapper tr:hover td {
  background: #f9fafb;
}`
  },

  'table-striped-minimal': {
    id: 'table-striped-minimal',
    name: 'Minimal Striped Table',
    description: 'TableWidget with subtle striped rows',
    category: 'component',
    template: `<div class="table-minimal">
  {{{content}}}
</div>`,
    css: `.table-minimal table {
  width: 100%;
  border-collapse: collapse;
}
.table-minimal th {
  background: #f9fafb;
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
}
.table-minimal td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f3f4f6;
}
.table-minimal tr:nth-child(even) {
  background: #fafbfc;
}
.table-minimal tr:hover {
  background: #f3f4f6;
}`
  },

  // ========== NAVBAR WIDGET SCENARIOS ==========
  'navbar-gradient': {
    id: 'navbar-gradient',
    name: 'Gradient Navbar',
    description: 'NavbarWidget with gradient background',
    category: 'component',
    template: `<div class="navbar-gradient">
  {{{content}}}
</div>`,
    css: `.navbar-gradient {
  background: linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.navbar-gradient a {
  color: white;
  font-weight: 500;
  transition: opacity 0.2s;
}
.navbar-gradient a:hover {
  opacity: 0.8;
}`
  },

  'navbar-glass': {
    id: 'navbar-glass',
    name: 'Glassmorphism Navbar',
    description: 'NavbarWidget with frosted glass effect',
    category: 'component',
    template: `<div class="navbar-glass">
  {{{content}}}
</div>`,
    css: `.navbar-glass {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
.navbar-glass a {
  color: #1f2937;
  font-weight: 500;
}`
  },

  // ========== FOOTER WIDGET SCENARIOS ==========
  'footer-dark-modern': {
    id: 'footer-dark-modern',
    name: 'Dark Modern Footer',
    description: 'FooterWidget with dark theme and accent colors',
    category: 'component',
    template: `<div class="footer-dark">
  {{{content}}}
</div>`,
    css: `.footer-dark {
  background: #111827;
  color: #e5e7eb;
  padding: 3rem 2rem;
  border-top: 3px solid #3b82f6;
}
.footer-dark h3 {
  color: white;
  font-size: 1.125rem;
  margin-bottom: 1.25rem;
  position: relative;
  padding-bottom: 0.75rem;
}
.footer-dark h3::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 3rem;
  height: 2px;
  background: #3b82f6;
}
.footer-dark a {
  color: #9ca3af;
  transition: color 0.2s;
}
.footer-dark a:hover {
  color: #60a5fa;
}`
  },

  'footer-gradient': {
    id: 'footer-gradient',
    name: 'Gradient Footer',
    description: 'FooterWidget with gradient background',
    category: 'component',
    template: `<div class="footer-gradient">
  {{{content}}}
</div>`,
    css: `.footer-gradient {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 3rem 2rem;
}
.footer-gradient h3 {
  color: white;
  opacity: 0.95;
}
.footer-gradient a {
  color: rgba(255, 255, 255, 0.9);
  transition: opacity 0.2s;
}
.footer-gradient a:hover {
  opacity: 1;
  text-decoration: underline;
}`
  },

  // ========== NAVIGATION WIDGET SCENARIOS ==========
  'navigation-sidebar': {
    id: 'navigation-sidebar',
    name: 'Sidebar Navigation',
    description: 'NavigationWidget styled for sidebar placement',
    category: 'component',
    template: `<nav class="nav-sidebar">
  <div class="nav-title">Navigation</div>
  {{#items}}
    <a href="{{url}}" class="nav-item {{#isActive}}active{{/isActive}}">
      {{label}}
    </a>
  {{/items}}
</nav>`,
    css: `.nav-sidebar {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.nav-title {
  font-weight: 700;
  font-size: 0.875rem;
  text-transform: uppercase;
  color: #6b7280;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #e5e7eb;
}
.nav-item {
  display: block;
  padding: 0.75rem 1rem;
  color: #4b5563;
  text-decoration: none;
  border-radius: 6px;
  margin-bottom: 0.25rem;
  transition: all 0.2s;
}
.nav-item:hover {
  background: #f3f4f6;
  color: #1f2937;
}
.nav-item.active {
  background: #eff6ff;
  color: #3b82f6;
  font-weight: 600;
}`
  },

  'navigation-breadcrumb': {
    id: 'navigation-breadcrumb',
    name: 'Breadcrumb Style',
    description: 'NavigationWidget as breadcrumb trail',
    category: 'component',
    template: `<nav class="nav-breadcrumb">
  {{#items}}
    <a href="{{url}}" class="breadcrumb-item">{{label}}</a>
    {{^last}}<span class="breadcrumb-sep">/</span>{{/last}}
  {{/items}}
</nav>`,
    css: `.nav-breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  font-size: 0.875rem;
}
.breadcrumb-item {
  color: #6b7280;
  text-decoration: none;
  transition: color 0.2s;
}
.breadcrumb-item:hover {
  color: #3b82f6;
}
.breadcrumb-item:last-child {
  color: #1f2937;
  font-weight: 600;
}
.breadcrumb-sep {
  color: #d1d5db;
}`
  },

  // ========== HERO WIDGET SCENARIOS ==========
  'hero-centered': {
    id: 'hero-centered',
    name: 'Centered Hero',
    description: 'HeroWidget with centered content and overlay',
    category: 'component',
    template: `<div class="hero-centered">
  <div class="hero-overlay"></div>
  <div class="hero-centered-content">
    {{{content}}}
  </div>
</div>`,
    css: `.hero-centered {
  position: relative;
  min-height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: #0f172a;
  overflow: hidden;
}
.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(45deg, rgba(59, 130, 246, 0.8), rgba(139, 92, 246, 0.6));
}
.hero-centered-content {
  position: relative;
  z-index: 1;
  max-width: 800px;
  padding: 2rem;
  color: white;
}
.hero-centered-content h1 {
  font-size: 4rem;
  font-weight: 900;
  margin: 0 0 1.5rem 0;
  line-height: 1.1;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}
.hero-centered-content .after-text {
  font-size: 1.5rem;
  opacity: 0.95;
  line-height: 1.6;
}
@media (max-width: 768px) {
  .hero-centered {
    min-height: 400px;
  }
  .hero-centered-content h1 {
    font-size: 2.5rem;
  }
}`
  },

  'hero-minimal': {
    id: 'hero-minimal',
    name: 'Minimal Hero',
    description: 'HeroWidget with clean minimal design',
    category: 'component',
    template: `<div class="hero-minimal">
  {{{content}}}
</div>`,
    css: `.hero-minimal {
  padding: 8rem 2rem 4rem;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}
.hero-minimal h1 {
  font-size: 3rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 1rem 0;
  max-width: 800px;
}
.hero-minimal .before-text {
  font-size: 1rem;
  color: #3b82f6;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 1.5rem;
}
.hero-minimal .after-text {
  font-size: 1.25rem;
  color: #6b7280;
  max-width: 600px;
  line-height: 1.7;
}`
  },

  // ========== FORM WIDGET SCENARIOS ==========
  'form-modern-card': {
    id: 'form-modern-card',
    name: 'Modern Form Card',
    description: 'FormsWidget in elevated card design',
    category: 'component',
    template: `<div class="form-card-wrapper">
  <div class="form-card">
    {{{content}}}
  </div>
</div>`,
    css: `.form-card-wrapper {
  max-width: 600px;
  margin: 2rem auto;
}
.form-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  padding: 3rem;
  border-top: 4px solid #3b82f6;
}
.form-card h2 {
  color: #1f2937;
  margin-top: 0;
  margin-bottom: 0.5rem;
}
.form-card .form-description {
  color: #6b7280;
  margin-bottom: 2rem;
}
.form-card input,
.form-card textarea,
.form-card select {
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.2s;
}
.form-card input:focus,
.form-card textarea:focus,
.form-card select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
.form-card .submit-button {
  width: 100%;
  padding: 1rem;
  font-size: 1.125rem;
  border-radius: 8px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}`
  },

  'form-inline-compact': {
    id: 'form-inline-compact',
    name: 'Inline Compact Form',
    description: 'FormsWidget with inline layout',
    category: 'component',
    template: `<div class="form-inline">
  {{{content}}}
</div>`,
    css: `.form-inline {
  background: #f9fafb;
  padding: 2rem;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}
.form-inline form {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  flex-wrap: wrap;
}
.form-inline .form-group {
  flex: 1;
  min-width: 200px;
  margin-bottom: 0;
}
.form-inline input,
.form-inline select {
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}
.form-inline .submit-button {
  padding: 0.75rem 2rem;
  border-radius: 6px;
  white-space: nowrap;
}`
  },

  // ========== SIDEBAR WIDGET SCENARIOS ==========
  'sidebar-accent': {
    id: 'sidebar-accent',
    name: 'Accent Sidebar',
    description: 'SidebarWidget with accent border',
    category: 'component',
    template: `<aside class="sidebar-accent">
  {{{content}}}
</aside>`,
    css: `.sidebar-accent {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  border-left: 4px solid #3b82f6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.sidebar-accent h3 {
  color: #1f2937;
  font-size: 1.25rem;
  margin-top: 0;
  margin-bottom: 1.25rem;
}
.sidebar-accent ul {
  list-style: none;
  padding: 0;
}
.sidebar-accent li {
  padding: 0.5rem 0;
  border-bottom: 1px solid #f3f4f6;
}
.sidebar-accent li:last-child {
  border-bottom: none;
}
.sidebar-accent a {
  color: #4b5563;
  text-decoration: none;
  transition: color 0.2s;
}
.sidebar-accent a:hover {
  color: #3b82f6;
}`
  },

  // ========== NEWS WIDGET SCENARIOS ==========
  'news-card-grid': {
    id: 'news-card-grid',
    name: 'News Card Grid',
    description: 'NewsListWidget in card grid layout',
    category: 'component',
    template: `<div class="news-grid">
  {{{content}}}
</div>`,
    css: `.news-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
  padding: 2rem 0;
}
.news-grid .news-item {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s;
}
.news-grid .news-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
.news-grid .news-image {
  aspect-ratio: 16/9;
  overflow: hidden;
}
.news-grid .news-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.news-grid .news-content {
  padding: 1.5rem;
}
.news-grid h3 {
  margin: 0 0 0.75rem 0;
  color: #1f2937;
  font-size: 1.25rem;
}`
  },

  'news-timeline': {
    id: 'news-timeline',
    name: 'News Timeline',
    description: 'NewsListWidget in vertical timeline layout',
    category: 'component',
    template: `<div class="news-timeline">
  {{{content}}}
</div>`,
    css: `.news-timeline {
  position: relative;
  padding-left: 3rem;
}
.news-timeline::before {
  content: '';
  position: absolute;
  left: 1rem;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #e5e7eb;
}
.news-timeline .news-item {
  position: relative;
  margin-bottom: 2rem;
  padding-left: 1.5rem;
}
.news-timeline .news-item::before {
  content: '';
  position: absolute;
  left: -2.5rem;
  top: 0.25rem;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: #3b82f6;
  border: 3px solid white;
  box-shadow: 0 0 0 2px #e5e7eb;
}
.news-timeline .news-date {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}
.news-timeline h3 {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
}
.news-timeline .news-excerpt {
  color: #6b7280;
  line-height: 1.6;
}`
  },

  // ========== TWO/THREE COLUMN SCENARIOS ==========
  'columns-balanced': {
    id: 'columns-balanced',
    name: 'Balanced Columns',
    description: 'Column widgets with equal spacing and dividers',
    category: 'component',
    template: `<div class="columns-balanced">
  {{{content}}}
</div>`,
    css: `.columns-balanced {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 3rem;
  padding: 2rem;
  position: relative;
}
.columns-balanced > * {
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
.columns-balanced > *:not(:last-child)::after {
  content: '';
  position: absolute;
  right: -1.5rem;
  top: 2rem;
  bottom: 2rem;
  width: 1px;
  background: #e5e7eb;
}
@media (max-width: 768px) {
  .columns-balanced {
    grid-template-columns: 1fr;
  }
  .columns-balanced > *::after {
    display: none;
  }
}`
  },

  'columns-feature-boxes': {
    id: 'columns-feature-boxes',
    name: 'Feature Boxes',
    description: 'Column widgets as feature boxes with icons',
    category: 'component',
    template: `<div class="feature-boxes">
  {{{content}}}
</div>`,
    css: `.feature-boxes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  padding: 2rem 0;
}
.feature-boxes > * {
  background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  transition: all 0.3s;
}
.feature-boxes > *:hover {
  border-color: #3b82f6;
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(59, 130, 246, 0.15);
}
.feature-boxes h3 {
  color: #1f2937;
  font-size: 1.5rem;
  margin: 0 0 1rem 0;
}
.feature-boxes p {
  color: #6b7280;
  line-height: 1.7;
}`
  }
};

// Helper functions for filtering presets
export const getPresetsByCategory = (category) => {
  return Object.values(STYLE_PRESETS).filter(preset => preset.category === category);
};

export const getPresetById = (id) => {
  return STYLE_PRESETS[id];
};

export const getAllCategories = () => {
  return [...new Set(Object.values(STYLE_PRESETS).map(preset => preset.category))];
};

