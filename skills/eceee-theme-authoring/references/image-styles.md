# Image Styles

Use this reference for Image widget, inline media, galleries, carousels, lightboxes, sizing, and alignment.

## Existing capabilities

Named image styles live in a theme's `image_styles` dictionary. Each style can define:

- `name`, `description`, `styleType`, and `usageType`;
- a Mustache `template` and breakpoint-aware `css`;
- fixed style `variables` merged into the Mustache context;
- `imgproxyConfig` and `lightboxConfig`;
- caption, lightbox, randomization, and carousel defaults.

The Image widget resolves a selected style from the current theme and renders it through the existing gallery or carousel context. A gallery style can render one image as well as a collection.

## Template context

Confirm the current contract in:

- backend: `backend/webpages/utils/mustache_renderer.py`;
- editor preview: `frontend/src/utils/mustacheRenderer.js`;
- widget integration: `backend/easy_widgets/widgets/image.py` and `frontend/src/widgets/easy-widgets/ImageWidget.jsx`.

Common context includes `images`, `imageCount`, `multipleImages`, caption/lightbox flags, and all style variables. Each image provides processed URLs, alt text, caption metadata, dimensions, and responsive data when available. Do not assume arbitrary widget config is exposed to a named Image Style template.

## Size and alignment with existing code

To let an editor choose size and alignment without product-code changes, create clearly named style variants. The selected style supplies fixed variables such as:

```json
{
  "size": "small",
  "alignment": "left",
  "maxWidth": "20rem"
}
```

Use one shared template/CSS contract across the variants. The template may emit stable classes such as `eceee-image-size-{{size}}` and `eceee-image-align-{{alignment}}`; CSS sets the maximum width and margins. Because one Image Style selection carries both choices, arbitrary combinations require explicit named variants. Do not claim that a single style creates new page-editor dropdowns.

Start with the combinations the product actually needs. If full independent choice is required, the complete matrix is Small/Medium/Large/Full × Left/Center/Right. Use labels such as `Image — Small — Left` and stable keys such as `image-small-left`.

## Responsive and media rules

- Make every image `max-width: 100%` with intrinsic aspect ratio preserved.
- Treat configured widths as desktop maxima; collapse to available width on narrow viewports.
- Align with wrapper margins, not transforms or absolute positioning.
- Keep caption width and alignment consistent with the image.
- Configure imgproxy near the largest rendered width and avoid upscaling beyond source dimensions.
- Preserve alt text and responsive `srcset`/dimensions in templates.
- Scope CSS under a style-specific root to prevent one style from changing another.
- Keep lightbox output independent of thumbnail sizing.

## Inline media distinction

Inline Content widget media already persists width and alignment metadata and renders `media-width-*`/`media-align-*` classes. Do not conflate that path with the standalone Image widget. Inspect `frontend/src/utils/mediaInsertRenderer.js` and `backend/easy_widgets/widgets/content.py` when inline media is in scope.
