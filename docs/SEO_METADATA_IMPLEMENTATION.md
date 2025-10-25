# SEO Metadata & Icon Rendering Implementation

## Overview

Implemented comprehensive SEO metadata rendering for pages, including dynamic title/description from PageVersion, Open Graph tags, and site icon support for root pages with imgproxy integration.

## Implementation Summary

### 1. Backend Model Changes

#### WebPage Model (`backend/webpages/models/web_page.py`)
- Added `site_icon` ImageField for storing site icons/favicons (root pages only)
- Added validation in `clean()` method to ensure only root pages can have site icons
- Added `get_root_page()` helper method to traverse hierarchy and get the root page
- Created migration `0041_add_site_icon.py`

### 2. Template System Updates

#### Base Templates
- **`backend/templates/base.html`**
  - Replaced static `<title>` with dynamic `{% block page_title %}`
  - Added `{% block meta_tags %}` for SEO meta tags
  - Added `{% block icon_tags %}` for favicon/app icons

- **`backend/templates/base_default.html`**
  - Added same SEO blocks with backward compatibility for `{% block title %}`

#### Layout Templates
Updated all layout templates to use new SEO blocks:
- `backend/eceee_layouts/templates/eceee_layouts/layouts/main_layout.html`
- `backend/eceee_layouts/templates/eceee_layouts/layouts/landing_page.html`
- `backend/eceee_layouts/templates/eceee_layouts/layouts/minimal.html`
- `backend/templates/webpages/page_detail.html`

Each template now includes:
```django
{% block page_title %}
  {% if meta_title %}{{ meta_title }}{% else %}{{ current_page.title }}{% endif %}
  {% if root_page %} - {{ root_page.title }}{% endif %}
{% endblock %}

{% block meta_tags %}
  {% render_page_seo page=current_page version=content page_data=page_data %}
{% endblock %}

{% block icon_tags %}
  {% render_site_icons root_page=root_page %}
{% endblock %}
```

### 3. Template Tags (`backend/webpages/templatetags/webpages_tags.py`)

#### New Template Tag: `render_page_seo`
Generates comprehensive SEO meta tags:
- Meta description
- Open Graph tags (og:title, og:description, og:type, og:url)
- Twitter Card tags
- Automatically escapes content for HTML safety
- Prioritizes: page_data > version > page for metadata

#### New Template Tag: `render_site_icons`
Generates favicon and app icon tags using imgproxy:
- Standard favicons: 16x16, 32x32, 48x48 (PNG)
- Apple touch icons: 180x180, 152x152, 120x120 (PNG)
- Android/Chrome icons: 192x192, 512x512 (PNG)
- Favicon.ico: 32x32 (ICO format)
- All icons generated on-the-fly using imgproxy for optimal performance

### 4. View Updates

#### HostnamePageView (`backend/webpages/public_views.py`)
- Added `meta_title` and `meta_description` to context from `page_data`
- Added `content` (PageVersion) to context for template access
- Context now includes SEO-ready metadata for all public pages

#### PageDetailView (`backend/webpages/public_views.py`)
- Added same SEO metadata to context
- Added `root_page` to context for icon inheritance
- Added `current_page` to context for consistency

### 5. Serializer Updates (`backend/webpages/serializers.py`)

#### WebPageTreeSerializer & WebPageSimpleSerializer
- Added `site_icon` field to both serializers
- Field automatically includes URL when serialized

#### WebPageSimpleSerializer Validation
- Added `validate()` method to ensure only root pages can have site icons
- Validates both on create and update operations
- Returns clear error message if validation fails

### 6. Frontend Updates

#### SettingsEditor (`frontend/src/components/SettingsEditor.tsx`)
- Added site icon upload section (only visible for root pages)
- Displays current icon with preview image
- Shows helpful description about automatic resizing
- Includes remove button for existing icons
- File input accepts: PNG, JPG, SVG, WebP
- Conditional rendering based on `!webpageData?.parent`

## Usage

### Backend Templates

Templates automatically receive SEO metadata when using the updated views. The template tags handle:
- Extracting metadata from page_data
- Falling back to version metadata
- Finally falling back to page properties
- Proper HTML escaping for security

### Frontend Icon Upload

For root pages in the PageEditor:
1. Navigate to Settings & SEO tab
2. Scroll to "Site Icon (Favicon)" section
3. Upload a square image (recommended 512x512 or larger)
4. Save the page
5. Icons are automatically generated in all required sizes

### Icon Rendering

Icons are inherited from the root page down the hierarchy:
- Each page automatically gets its root page's icon
- No need to set icons on child pages
- imgproxy generates all sizes on-demand
- Proper caching ensures optimal performance

## Generated Meta Tags Example

```html
<!-- Page Title -->
<title>About Us - My Website</title>

<!-- SEO Meta Tags -->
<meta name="description" content="Learn more about our company and mission">
<meta property="og:title" content="About Us">
<meta property="og:description" content="Learn more about our company and mission">
<meta property="og:type" content="website">
<meta property="og:url" content="https://example.com/about">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="About Us">
<meta name="twitter:description" content="Learn more about our company and mission">

<!-- Site Icons -->
<link rel="icon" type="image/png" sizes="16x16" href="[imgproxy-url-16x16]">
<link rel="icon" type="image/png" sizes="32x32" href="[imgproxy-url-32x32]">
<link rel="icon" type="image/png" sizes="48x48" href="[imgproxy-url-48x48]">
<link rel="apple-touch-icon" sizes="180x180" href="[imgproxy-url-180x180]">
<link rel="apple-touch-icon" sizes="152x152" href="[imgproxy-url-152x152]">
<link rel="apple-touch-icon" sizes="120x120" href="[imgproxy-url-120x120]">
<link rel="icon" type="image/png" sizes="192x192" href="[imgproxy-url-192x192]">
<link rel="icon" type="image/png" sizes="512x512" href="[imgproxy-url-512x512]">
<link rel="shortcut icon" href="[imgproxy-url-32x32-ico]">
```

## Database Migration

Migration file: `backend/webpages/migrations/0041_add_site_icon.py`

Adds `site_icon` field to `webpages_webpage` table:
- Type: ImageField
- upload_to: "site_icons/"
- null: True
- blank: True

## Testing Checklist

- [x] Model validation prevents non-root pages from having site icons
- [x] Serializer validation enforces same rule via API
- [x] SEO meta tags render correctly with proper escaping
- [x] Icon tags generate all required sizes via imgproxy
- [x] Frontend only shows icon upload for root pages
- [x] Migration applies successfully
- [x] No linting errors in modified files

## Performance Considerations

- **Icon Generation**: imgproxy generates icons on-demand with caching
- **Meta Tags**: Minimal template overhead, no database queries
- **Template Rendering**: Efficient use of context data, no N+1 queries

## Security Considerations

- **HTML Escaping**: All user-provided metadata is escaped before rendering
- **File Validation**: Icon uploads validated by Django's ImageField
- **Model Validation**: Enforced at model level via `clean()` method
- **API Validation**: Enforced at API level via serializer `validate()` method

## Future Enhancements

Potential improvements:
- OG Image support (separate field for social media preview images)
- Automatic icon generation from uploaded images (already done!)
- Schema.org structured data support
- Sitemap.xml generation with proper metadata
- RSS feed support with SEO data
- Multi-language SEO support (hreflang tags)

