// Gallery style scenarios for Quick Reference in the GalleryStyleEditPage

export const galleryScenarios = [
    {
        id: 'simple-grid',
        name: 'Simple Grid',
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
        id: 'masonry-grid',
        name: 'Masonry (CSS Grid)',
        description: 'Masonry-like layout using auto-rows and row-span hints',
        variables: [
            { name: 'images', type: 'Array', description: 'Array of image objects' },
            { name: 'columns', type: 'Number', description: 'Number of columns (e.g., 3)' }
        ],
        itemProperties: [
            { name: 'url', type: 'String', description: 'Optimized image URL (1x)' },
            { name: 'displayWidth', type: 'Number', description: 'Calculated display width' },
            { name: 'displayHeight', type: 'Number', description: 'Calculated display height' },
            { name: 'altText', type: 'String', description: 'Accessible alt text' }
        ],
        template: `<div class="masonry">
  <div class="masonry-grid" style="grid-template-columns: repeat({{columns}}, 1fr);">
    {{#images}}
      <div class="masonry-item">
        <img src="{{url}}" width="{{displayWidth}}" height="{{displayHeight}}" alt="{{altText}}">
      </div>
    {{/images}}
  </div>
</div>`,
        css: `.masonry-grid { display: grid; grid-auto-rows: 8px; gap: 8px; }
.masonry-item { border-radius: 6px; overflow: hidden; }
.masonry-item img { width: 100%; height: auto; display: block; }`
    },
    {
        id: 'justified-rows',
        name: 'Justified Rows',
        description: 'Even-height rows with flexible item widths',
        variables: [
            { name: 'images', type: 'Array', description: 'Array of image objects' },
            { name: 'rowHeight', type: 'Number', description: 'Target row height in px (e.g., 220)' }
        ],
        itemProperties: [
            { name: 'url', type: 'String', description: 'Optimized image URL (1x)' },
            { name: 'altText', type: 'String', description: 'Accessible alt text' }
        ],
        template: `<div class="justified">
  <div class="justified-row">
    {{#images}}
      <img class="justified-img" src="{{url}}" alt="{{altText}}" loading="lazy">
    {{/images}}
  </div>
</div>`,
        css: `.justified-row { display: flex; flex-wrap: wrap; gap: 8px; }
.justified-img { height: var(--row-height, 220px); width: auto; object-fit: cover; }`
    },
    {
        id: 'caption-overlay',
        name: 'Caption Overlay',
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
  <div class="overlay-grid" style="grid-template-columns: repeat({{columns}}, 1fr);">
    {{#images}}
      <div class="overlay-item">
        <img src="{{url}}" alt="{{altText}}" loading="lazy">
        {{#showCaptions}}
        <div class="overlay">
          {{#title}}<h4>{{title}}</h4>{{/title}}
          {{#caption}}<p>{{caption}}</p>{{/caption}}
        </div>
        {{/showCaptions}}
      </div>
    {{/images}}
  </div>
</div>`,
        css: `.overlay-grid { display: grid; gap: 1rem; }
.overlay-item { position: relative; overflow: hidden; border-radius: 8px; }
.overlay-item img { width: 100%; height: auto; display: block; transition: transform 0.3s; }
.overlay-item:hover img { transform: scale(1.05); }
.overlay { position: absolute; inset: auto 0 0 0; background: rgba(0,0,0,0.6); color: #fff; padding: 0.75rem; transform: translateY(100%); transition: transform 0.3s; }
.overlay-item:hover .overlay { transform: translateY(0); }`
    },
    {
        id: 'lightbox-ready',
        name: 'Lightbox Ready',
        description: 'Images with built-in lightbox support and custom button styling',
        variables: [
            { name: 'images', type: 'Array', description: 'Array of image objects' },
            { name: 'columns', type: 'Number', description: 'Number of grid columns' },
            { name: 'enableLightbox', type: 'Boolean', description: 'Enable lightbox functionality' },
            { name: 'lightboxStyle', type: 'String', description: 'Lightbox style key (default: "default")' },
            { name: 'galleryGroup', type: 'String', description: 'Group key for navigation between images' },
            { name: 'lightboxButtonClass', type: 'String', description: 'Custom button CSS classes' },
            { name: 'lightboxCloseIcon', type: 'String', description: 'Custom close button HTML' },
            { name: 'lightboxPrevIcon', type: 'String', description: 'Custom previous button HTML' },
            { name: 'lightboxNextIcon', type: 'String', description: 'Custom next button HTML' }
        ],
        itemProperties: [
            { name: 'url', type: 'String', description: 'Optimized image URL (1x)' },
            { name: 'lightboxUrl', type: 'String', description: 'Lightbox full-size URL (configured separately)' },
            { name: 'srcset', type: 'String', description: 'Responsive srcset candidates' },
            { name: 'displayWidth', type: 'Number', description: 'Calculated display width' },
            { name: 'displayHeight', type: 'Number', description: 'Calculated display height' },
            { name: 'altText', type: 'String', description: 'Accessible alt text' },
            { name: 'caption', type: 'String', description: 'Image caption/title' }
        ],
        template: `<div class="lb-gallery">
  <div class="lb-grid" style="grid-template-columns: repeat({{columns}}, 1fr);">
    {{#images}}
      <a class="lb-item"
         data-lightbox
         data-lightbox-group="{{galleryGroup}}"
         data-lightbox-style="{{lightboxStyle}}"
         data-lightbox-src="{{lightboxUrl}}"
         data-lightbox-caption="{{caption}}"
         data-lightbox-alt="{{altText}}"
         {{#lightboxButtonClass}}data-lightbox-button-class="{{lightboxButtonClass}}"{{/lightboxButtonClass}}
         {{#lightboxCloseIcon}}data-lightbox-close-html="{{lightboxCloseIcon}}"{{/lightboxCloseIcon}}
         {{#lightboxPrevIcon}}data-lightbox-prev-html="{{lightboxPrevIcon}}"{{/lightboxPrevIcon}}
         {{#lightboxNextIcon}}data-lightbox-next-html="{{lightboxNextIcon}}"{{/lightboxNextIcon}}
         href="{{lightboxUrl}}">
        <img src="{{url}}" srcset="{{srcset}}" 
             width="{{displayWidth}}" height="{{displayHeight}}"
             alt="{{altText}}" loading="lazy">
      </a>
    {{/images}}
  </div>
</div>`,
        css: `.lb-grid { display: grid; gap: 8px; }
.lb-item { cursor: pointer; }
.lb-item img { width: 100%; height: auto; display: block; border-radius: 6px; transition: opacity 0.2s; }
.lb-item:hover img { opacity: 0.9; }`
    }
];

export function getGalleryScenarioById(id) {
    return galleryScenarios.find(s => s.id === id) || galleryScenarios[0];
}


