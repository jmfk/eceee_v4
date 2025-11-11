// Image style scenarios for Quick Reference in ImageStyleEditPage
// Includes both gallery and carousel type scenarios

export const imageStyleScenarios = [
    // GALLERY SCENARIOS
    {
        id: 'simple-grid',
        name: 'Simple Grid (Gallery)',
        styleType: 'gallery',
        description: 'Responsive grid with equal-sized items and optional captions',
        variables: [
            { name: 'images', type: 'Array', description: 'Array of image objects' },
            { name: 'columns', type: 'Number', description: 'Number of grid columns' },
            { name: 'showCaptions', type: 'Boolean', description: 'Show image captions' }
        ],
        itemProperties: [
            { name: 'url', type: 'String', description: 'Optimized image URL (1x)' },
            { name: 'lightboxUrl', type: 'String', description: 'Lightbox full-size URL' },
            { name: 'srcset', type: 'String', description: 'Responsive srcset candidates' },
            { name: 'displayWidth', type: 'Number', description: 'Calculated display width' },
            { name: 'displayHeight', type: 'Number', description: 'Calculated display height' },
            { name: 'altText', type: 'String', description: 'Accessible alt text' },
            { name: 'caption', type: 'String', description: 'Image caption text' }
        ],
        template: `<div class="gallery">
  <div class="gallery-grid" style="grid-template-columns: repeat({{columns}}, 1fr);">
    {{#images}}
      <div class="gallery-item" data-index="{{index}}">
        <img src="{{url}}" srcset="{{srcset}}" 
             width="{{displayWidth}}" height="{{displayHeight}}" 
             alt="{{altText}}" loading="lazy">
        {{#showCaptions}}{{#caption}}<p class="caption">{{caption}}</p>{{/caption}}{{/showCaptions}}
      </div>
    {{/images}}
  </div>
</div>`,
        css: `.gallery { margin: 1rem 0; }
.gallery-grid { display: grid; gap: 1rem; }
.gallery-item img { width: 100%; height: auto; display: block; }`
    },
    {
        id: 'caption-overlay',
        name: 'Caption Overlay (Gallery)',
        styleType: 'gallery',
        description: 'Hover overlay showing title and caption',
        variables: [
            { name: 'images', type: 'Array', description: 'Array of image objects' },
            { name: 'columns', type: 'Number', description: 'Number of grid columns' },
            { name: 'showCaptions', type: 'Boolean', description: 'Show overlay captions' }
        ],
        itemProperties: [
            { name: 'url', type: 'String', description: 'Optimized image URL (1x)' },
            { name: 'altText', type: 'String', description: 'Accessible alt text' },
            { name: 'title', type: 'String', description: 'Image title' },
            { name: 'caption', type: 'String', description: 'Image caption' }
        ],
        template: `<div class="overlay-gallery">
  <div class="grid" style="grid-template-columns: repeat({{columns}}, 1fr);">
    {{#images}}
      <div class="item">
        <img src="{{url}}" alt="{{altText}}">
        {{#showCaptions}}
          <div class="overlay">
            {{#title}}<h3>{{title}}</h3>{{/title}}
            {{#caption}}<p>{{caption}}</p>{{/caption}}
          </div>
        {{/showCaptions}}
      </div>
    {{/images}}
  </div>
</div>`,
        css: `.overlay-gallery .grid { display: grid; gap: 1rem; }
.item { position: relative; overflow: hidden; }
.item img { width: 100%; height: auto; display: block; transition: transform 0.3s; }
.item:hover img { transform: scale(1.05); }
.overlay { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.8)); color: white; padding: 1rem; opacity: 0; transition: opacity 0.3s; }
.item:hover .overlay { opacity: 1; }`
    },
    
    // CAROUSEL SCENARIOS
    {
        id: 'basic-carousel',
        name: 'Basic Carousel',
        styleType: 'carousel',
        description: 'Simple carousel with prev/next buttons using Alpine.js',
        variables: [
            { name: 'images', type: 'Array', description: 'Array of image objects' },
            { name: 'imageCount', type: 'Number', description: 'Total number of images' },
            { name: 'multipleImages', type: 'Boolean', description: 'True if more than one image' },
            { name: 'showCaptions', type: 'Boolean', description: 'Show image captions' }
        ],
        itemProperties: [
            { name: 'url', type: 'String', description: 'Optimized image URL' },
            { name: 'altText', type: 'String', description: 'Accessible alt text' },
            { name: 'caption', type: 'String', description: 'Image caption' },
            { name: 'index', type: 'Number', description: 'Image index (0-based)' }
        ],
        template: `<div class="carousel" x-data="{ current: 0, total: {{imageCount}} }">
  <div class="carousel-track" :style="'transform: translateX(-' + (current * 100) + '%)'">
    {{#images}}
      <div class="carousel-slide">
        <img src="{{url}}" alt="{{altText}}" loading="lazy">
        {{#showCaptions}}{{#caption}}<p class="caption">{{caption}}</p>{{/caption}}{{/showCaptions}}
      </div>
    {{/images}}
  </div>
  {{#multipleImages}}
  <button @click="current = (current - 1 + total) % total" class="nav-btn prev">‹</button>
  <button @click="current = (current + 1) % total" class="nav-btn next">›</button>
  {{/multipleImages}}
</div>`,
        css: `.carousel { position: relative; overflow: hidden; border-radius: 8px; }
.carousel-track { display: flex; transition: transform 0.5s ease; }
.carousel-slide { min-width: 100%; }
.carousel-slide img { width: 100%; height: auto; display: block; }
.nav-btn { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.9); border: none; padding: 1rem; cursor: pointer; font-size: 1.5rem; }
.nav-btn.prev { left: 1rem; }
.nav-btn.next { right: 1rem; }`
    },
    {
        id: 'carousel-with-indicators',
        name: 'Carousel with Indicators',
        styleType: 'carousel',
        description: 'Carousel with navigation dots/indicators',
        variables: [
            { name: 'images', type: 'Array', description: 'Array of image objects' },
            { name: 'imageCount', type: 'Number', description: 'Total number of images' },
            { name: 'multipleImages', type: 'Boolean', description: 'True if more than one image' }
        ],
        itemProperties: [
            { name: 'url', type: 'String', description: 'Optimized image URL' },
            { name: 'altText', type: 'String', description: 'Accessible alt text' },
            { name: 'index', type: 'Number', description: 'Image index (0-based)' },
            { name: 'first', type: 'Boolean', description: 'True for first item' }
        ],
        template: `<div class="carousel-dots" x-data="{ current: 0, total: {{imageCount}} }">
  <div class="track" :style="'transform: translateX(-' + (current * 100) + '%)'">
    {{#images}}
      <div class="slide">
        <img src="{{url}}" alt="{{altText}}">
      </div>
    {{/images}}
  </div>
  {{#multipleImages}}
  <div class="indicators">
    {{#images}}
      <button @click="current = {{index}}" :class="current === {{index}} ? 'active' : ''" class="dot"></button>
    {{/images}}
  </div>
  {{/multipleImages}}
</div>`,
        css: `.carousel-dots { position: relative; overflow: hidden; }
.track { display: flex; transition: transform 0.5s ease; }
.slide { min-width: 100%; }
.slide img { width: 100%; height: auto; display: block; }
.indicators { position: absolute; bottom: 1rem; left: 50%; transform: translateX(-50%); display: flex; gap: 0.5rem; }
.dot { width: 0.75rem; height: 0.75rem; border-radius: 50%; background: rgba(255,255,255,0.5); border: none; cursor: pointer; transition: background 0.2s; }
.dot.active { background: white; }`
    },
    {
        id: 'fade-carousel',
        name: 'Fade Carousel',
        styleType: 'carousel',
        description: 'Carousel with fade transition effect',
        variables: [
            { name: 'images', type: 'Array', description: 'Array of image objects' },
            { name: 'imageCount', type: 'Number', description: 'Total number of images' },
            { name: 'multipleImages', type: 'Boolean', description: 'True if more than one image' }
        ],
        itemProperties: [
            { name: 'url', type: 'String', description: 'Optimized image URL' },
            { name: 'altText', type: 'String', description: 'Accessible alt text' },
            { name: 'index', type: 'Number', description: 'Image index (0-based)' }
        ],
        template: `<div class="fade-carousel" x-data="{ current: 0, total: {{imageCount}} }">
  <div class="slides">
    {{#images}}
      <div class="slide" x-show="current === {{index}}" 
           x-transition:enter="transition ease-out duration-300"
           x-transition:enter-start="opacity-0"
           x-transition:enter-end="opacity-100">
        <img src="{{url}}" alt="{{altText}}">
      </div>
    {{/images}}
  </div>
  {{#multipleImages}}
  <button @click="current = (current - 1 + total) % total" class="btn prev">◀</button>
  <button @click="current = (current + 1) % total" class="btn next">▶</button>
  {{/multipleImages}}
</div>`,
        css: `.fade-carousel { position: relative; width: 100%; }
.slides { position: relative; width: 100%; aspect-ratio: 16/9; }
.slide { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.slide img { width: 100%; height: 100%; object-fit: cover; }
.btn { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.7); color: white; border: none; padding: 1rem; cursor: pointer; }
.btn.prev { left: 1rem; }
.btn.next { right: 1rem; }`
    }
];

export const getScenarioById = (id) => {
    return imageStyleScenarios.find(s => s.id === id) || imageStyleScenarios[0];
};

export const getScenariosByType = (styleType) => {
    return imageStyleScenarios.filter(s => s.styleType === styleType);
};

