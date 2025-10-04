# imgproxy Template Tags Documentation

> **Django template tags for flexible, config-driven image optimization**  
> **Status**: Production Ready ✅  
> **Location**: `file_manager.templatetags.imgproxy_tags`

## 📋 Overview

The imgproxy template tags provide a clean, flexible way to generate optimized image URLs directly in Django templates. These tags integrate seamlessly with widget configurations, allowing for both explicit parameters and config-driven image display settings.

### 🎯 Key Features

- **Flexible Configuration**: Support for explicit parameters, settings dicts, or both
- **Smart URL Extraction**: Automatically extracts URLs from image objects, dicts, or strings
- **Auto Alt Text**: Generates alt text from image metadata when not provided
- **Widget-Friendly**: Designed to work with widget config structures
- **Graceful Fallbacks**: Returns original URL if imgproxy fails
- **Rich Parameters**: Supports all imgproxy processing options

---

## 🚀 Quick Start

### Load the Template Tags

```django
{% load imgproxy_tags %}
```

### Basic Usage

```django
{# Simple image optimization #}
<img src="{% imgproxy config.image width=800 height=600 %}">

{# Complete img tag #}
{% imgproxy_img config.image width=1920 height=400 resize_type='fill' gravity='sm' class_name='hero-image' %}

{# Using filter #}
<img src="{{ config.image|imgproxy_url:'800x600' }}">
```

---

## 📖 Template Tags Reference

### 1. `{% imgproxy %}` - URL Generation

Generate an imgproxy URL from an image object.

**Signature**:
```django
{% imgproxy image_obj [settings=dict] [width=int] [height=int] [resize_type=str] [gravity=str] [quality=int] [format=str] [preset=str] [**kwargs] %}
```

**Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `image_obj` | dict/str/object | *required* | Image object from widget config |
| `settings` | dict | None | Settings dict from widget config |
| `width` | int | None | Target width in pixels |
| `height` | int | None | Target height in pixels |
| `resize_type` | str | 'fit' | Resize mode: `fit`, `fill`, `crop`, `force` |
| `gravity` | str | 'sm' | Cropping focus (see gravity options) |
| `quality` | int | 85 | JPEG/WebP quality (1-100) |
| `format` | str | None | Output format: `jpg`, `png`, `webp`, `avif` |
| `preset` | str | None | Preset name: `thumbnail`, `small`, `medium`, `large`, `hero`, `avatar` |
| `**kwargs` | mixed | - | Additional imgproxy options (blur, sharpen, etc.) |

**Returns**: imgproxy URL string

**Examples**:

```django
{# Basic usage with explicit dimensions #}
<img src="{% imgproxy config.image width=800 height=600 %}">

{# With resize type and gravity #}
<img src="{% imgproxy config.image width=1920 height=1080 resize_type='fill' gravity='face' %}">

{# Using config-driven settings #}
<img src="{% imgproxy config.image settings=config.image_display %}">

{# Mix settings with explicit overrides #}
<img src="{% imgproxy config.image settings=config.display width=1920 %}">

{# Using preset #}
<img src="{% imgproxy config.image preset='hero' %}">

{# Advanced processing with kwargs #}
<img src="{% imgproxy config.image width=800 height=600 blur=5 sharpen=0.3 brightness=10 %}">

{# Focal point cropping #}
<img src="{% imgproxy config.image width=600 height=400 gravity='fp:0.5:0.3' %}">
```

---

### 2. `{% imgproxy_img %}` - Complete Image Tag

Generate a complete `<img>` element with imgproxy URL and proper attributes.

**Signature**:
```django
{% imgproxy_img image_obj [settings=dict] [alt=str] [class_name=str] [lazy=bool] [width=int] [height=int] [**kwargs] %}
```

**Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `image_obj` | dict/str/object | *required* | Image object from widget config |
| `settings` | dict | None | Settings dict from widget config |
| `alt` | str | auto | Alt text (auto-generated from image metadata if not provided) |
| `class_name` | str | None | CSS classes for img tag |
| `lazy` | bool | True | Enable lazy loading |
| Plus all parameters from `{% imgproxy %}` tag |

**Returns**: Rendered `<img>` element

**Examples**:

```django
{# Basic usage - auto-generates alt from image.title #}
{% imgproxy_img config.image width=800 height=600 %}

{# With CSS class #}
{% imgproxy_img config.image width=1920 height=400 class_name='hero-image' %}

{# With explicit alt text #}
{% imgproxy_img config.image width=400 height=400 alt='Profile Photo' gravity='face' %}

{# Using settings dict #}
{% imgproxy_img config.image settings=config.image_display class_name='header-image' %}

{# Disable lazy loading #}
{% imgproxy_img config.image width=800 lazy=False %}

{# Face detection for portraits #}
{% imgproxy_img config.image width=300 height=300 resize_type='fill' gravity='face' class_name='avatar' %}
```

---

### 3. `|imgproxy_url` - URL Filter

Simple filter for quick imgproxy URL generation.

**Signature**:
```django
{{ image_obj|imgproxy_url[:size] }}
```

**Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `image_obj` | dict/str | Image object or URL string |
| `size` | str | Optional size in format "WIDTHxHEIGHT" (e.g., "800x600") |

**Returns**: imgproxy URL string

**Examples**:

```django
{# No dimensions #}
<img src="{{ config.image|imgproxy_url }}">

{# With dimensions #}
<img src="{{ config.image|imgproxy_url:'800x600' }}">

{# Different sizes #}
<img src="{{ config.thumbnail|imgproxy_url:'300x300' }}">
<img src="{{ config.hero|imgproxy_url:'1920x1080' }}">
```

---

### 4. `|has_image` - Image Validation Filter

Check if an image object has a valid URL.

**Signature**:
```django
{{ image_obj|has_image }}
```

**Returns**: Boolean

**Examples**:

```django
{# Conditional rendering #}
{% if config.image|has_image %}
    {% imgproxy_img config.image width=800 %}
{% else %}
    <img src="/static/placeholder.jpg" alt="No image">
{% endif %}

{# Multiple images #}
{% if config.hero_image|has_image %}
    <div class="hero" style="background-image: url('{% imgproxy config.hero_image width=1920 %}')">
        ...
    </div>
{% endif %}
```

---

## 🎨 Processing Options Reference

### Resize Types

| Type | Description | Use Case |
|------|-------------|----------|
| `fit` | Resize to fit within dimensions (preserves aspect ratio) | Default, general use |
| `fill` | Resize and crop to fill dimensions exactly | Hero images, thumbnails |
| `crop` | Crop to dimensions without resizing | Precise cropping |
| `force` | Force resize ignoring aspect ratio | Special cases only |

### Gravity Options

Controls where to focus when cropping images.

**Smart Detection**:
- `sm` - Smart gravity (default) - AI-based focus on important areas

**Face Detection** (requires object detection enabled):
- `face` - Center on detected faces
- `obj:face` - Focus on face objects
- `obj:person` - Focus on person detection

**Directional**:
- `ce` - Center
- `no` - North (top)
- `so` - South (bottom)
- `ea` - East (right)
- `we` - West (left)
- `noea` - Northeast (top-right)
- `nowe` - Northwest (top-left)
- `soea` - Southeast (bottom-right)
- `sowe` - Southwest (bottom-left)

**Focal Point**:
- `fp:x:y` - Custom focal point where x and y are 0.0-1.0
  - Example: `fp:0.5:0.3` = 50% from left, 30% from top

### Format Options

| Format | Description | Best For |
|--------|-------------|----------|
| `jpg` | JPEG format | Photos, general images |
| `png` | PNG format | Graphics with transparency |
| `webp` | WebP format (modern) | Smaller files, wide support |
| `avif` | AVIF format (next-gen) | Smallest files, cutting-edge |
| `gif` | GIF format | Animated images |
| Auto | Let imgproxy decide | Recommended for production |

### Advanced Processing

Available via kwargs:

| Option | Type | Range | Description |
|--------|------|-------|-------------|
| `blur` | int | 0-100 | Blur radius |
| `sharpen` | float | 0-30 | Sharpen factor |
| `brightness` | int | -100 to 100 | Brightness adjustment |
| `contrast` | float | 0-10 | Contrast multiplier |
| `saturation` | float | 0-10 | Saturation multiplier |
| `grayscale` | bool | - | Convert to grayscale |

---

## 💡 Widget Integration Patterns

### Pattern 1: Explicit Parameters in Template

Simple and clear - all settings in template.

**Widget Config**:
```python
config = {
    'image': {
        'id': 'uuid',
        'imgproxy_base_url': 'http://minio:9000/...',
        'title': 'Header Image',
        'width': 4032,
        'height': 3024,
    }
}
```

**Template**:
```django
{% load imgproxy_tags %}

{% imgproxy_img config.image width=1920 height=400 resize_type='fill' gravity='sm' class_name='header-image' %}
```

---

### Pattern 2: Config-Driven Settings

Widget defines display settings - template stays clean.

**Widget Config**:
```python
config = {
    'image': { ... },
    'image_display': {
        'width': 1920,
        'height': 400,
        'resize_type': 'fill',
        'gravity': 'sm',
        'quality': 90,
    }
}
```

**Template**:
```django
{% load imgproxy_tags %}

{% imgproxy_img config.image settings=config.image_display class_name='header-image' %}
```

---

### Pattern 3: Hybrid Approach

Config provides defaults, template can override.

**Widget Config**:
```python
config = {
    'image': { ... },
    'image_display': {
        'height': 400,
        'resize_type': 'fill',
        'gravity': 'sm',
    }
}
```

**Template**:
```django
{% load imgproxy_tags %}

{# Override width for responsive design #}
{% imgproxy_img config.image settings=config.image_display width=1920 class_name='hero-desktop' %}
{% imgproxy_img config.image settings=config.image_display width=768 class_name='hero-mobile' %}
```

---

### Pattern 4: Multiple Images with Namespaced Settings

Widget with multiple images, each with own settings.

**Widget Config**:
```python
config = {
    'hero_image': { ... },
    'hero_display': {
        'width': 1920,
        'height': 600,
        'resize_type': 'fill',
        'gravity': 'ce',
    },
    
    'avatar_image': { ... },
    'avatar_display': {
        'width': 200,
        'height': 200,
        'resize_type': 'fill',
        'gravity': 'face',
        'format': 'webp',
    }
}
```

**Template**:
```django
{% load imgproxy_tags %}

<div class="hero" style="background-image: url('{% imgproxy config.hero_image settings=config.hero_display %}')">
    <div class="profile">
        {% imgproxy_img config.avatar_image settings=config.avatar_display class_name='avatar' %}
    </div>
</div>
```

---

## 🔧 Image Object Formats

The tags support multiple image object formats:

### Format 1: Serialized Dict (from MediaFile API)

```python
{
    'id': 'uuid',
    'slug': 'image-slug',
    'title': 'Image Title',
    'description': 'Image description',
    'width': 4032,
    'height': 3024,
    'imgproxy_base_url': 'http://minio:9000/eceee-media/uploads/...',
    'file_url': '/api/media/files/uuid/download/',
    # ... other fields
}
```

**URL Priority**: `imgproxy_base_url` > `file_url`

### Format 2: Plain String URL

```python
'http://example.com/image.jpg'
```

### Format 3: MediaFile Model Instance

```python
media_file = MediaFile.objects.get(id='uuid')
```

The tags will automatically extract `imgproxy_base_url` or `file_url` attributes.

---

## 🎯 Common Use Cases

### Hero Banner

```django
{% load imgproxy_tags %}

<div class="hero">
    {% imgproxy_img config.hero_image 
        width=1920 
        height=600 
        resize_type='fill' 
        gravity='sm' 
        quality=90 
        class_name='hero-banner' %}
</div>
```

### Profile Avatar with Face Detection

```django
{% imgproxy_img user.profile_image 
    width=200 
    height=200 
    resize_type='fill' 
    gravity='face' 
    format='webp' 
    class_name='avatar rounded-full' %}
```

### Gallery Thumbnails

```django
<div class="gallery">
    {% for image in config.images %}
        {% imgproxy_img image 
            width=300 
            height=300 
            resize_type='fill' 
            gravity='sm' 
            class_name='gallery-thumb' %}
    {% endfor %}
</div>
```

### Responsive Background Image

```django
<div class="banner" style="background-image: url('{% imgproxy config.background width=1920 height=400 resize_type='fill' %}')">
    <div class="content">
        {{ config.content }}
    </div>
</div>
```

### Conditional Image with Fallback

```django
{% if config.image|has_image %}
    {% imgproxy_img config.image width=800 height=600 %}
{% else %}
    <img src="{% static 'images/placeholder.jpg' %}" alt="Placeholder">
{% endif %}
```

### Art Direction with Different Crops

```django
<picture>
    {# Desktop: landscape crop #}
    <source media="(min-width: 1024px)" 
            srcset="{% imgproxy config.image width=1920 height=600 resize_type='fill' gravity='ce' %}">
    
    {# Tablet: square crop #}
    <source media="(min-width: 768px)" 
            srcset="{% imgproxy config.image width=800 height=800 resize_type='fill' gravity='sm' %}">
    
    {# Mobile: portrait crop #}
    <img src="{% imgproxy config.image width=600 height=800 resize_type='fill' gravity='sm' %}" 
         alt="{{ config.image.title }}">
</picture>
```

---

## 🚨 Error Handling

The tags handle errors gracefully:

### No Image / Invalid Image
```django
{% imgproxy None width=800 %}
{# Returns: empty string #}
```

### imgproxy Service Unavailable
```django
{% imgproxy config.image width=800 %}
{# Returns: original URL (config.image.imgproxy_base_url or file_url) #}
```

### Invalid Parameters
```django
{% imgproxy config.image width='invalid' %}
{# Logs warning, uses safe defaults #}
```

---

## 🧪 Testing

Run the template tag tests:

```bash
# All tests
docker-compose exec backend python manage.py test file_manager.tests.test_imgproxy_tags

# Specific test class
docker-compose exec backend python manage.py test file_manager.tests.test_imgproxy_tags.ImgproxyTagTests

# Specific test
docker-compose exec backend python manage.py test file_manager.tests.test_imgproxy_tags.ImgproxyTagTests.test_imgproxy_with_dict
```

---

## 📝 Best Practices

### 1. Use Settings Dicts for Consistency

Define image display settings in widget configuration for consistency across instances:

```python
# Widget configuration
image_display = {
    'width': 1920,
    'height': 400,
    'resize_type': 'fill',
    'gravity': 'sm',
    'quality': 90,
}
```

### 2. Explicit Alt Text for Accessibility

Always provide meaningful alt text for important images:

```django
{% imgproxy_img config.image width=800 alt='Company logo' %}
```

### 3. Use Presets for Common Sizes

Leverage imgproxy presets for standard sizes:

```django
{% imgproxy config.image preset='hero' %}
```

### 4. Optimize for Performance

- Use appropriate quality settings (85-90 for photos)
- Enable WebP/AVIF formats for smaller files
- Use lazy loading (enabled by default)

### 5. Face Detection for Portraits

Use face detection gravity for profile images and portraits:

```django
{% imgproxy_img user.avatar width=200 height=200 gravity='face' %}
```

---

## 🔗 Related Documentation

- [imgproxy Integration Guide](IMGPROXY_INTEGRATION_GUIDE.md)
- [Widget System Documentation](WIDGET_SYSTEM_DOCUMENTATION_INDEX.md)
- [Media System Guide](MEDIA_SYSTEM_README.md)

---

## 📚 Reference

### Parameter Priority Order

1. **Template kwargs** (highest priority)
2. **Explicit template parameters** (width, height, etc.)
3. **Settings dict**
4. **System defaults** (lowest priority)

### URL Extraction Priority

1. **imgproxy_base_url** (direct S3/MinIO - best performance)
2. **file_url** (Django API - fallback)
3. **String value** (if plain string passed)

### Alt Text Priority

1. **Explicit alt parameter**
2. **image.alt_text**
3. **image.title**
4. **image.description**
5. **Empty string**

---

## 🎉 Summary

The imgproxy template tags provide a powerful, flexible system for optimized image delivery in Django templates:

✅ **Simple API** - Clean, intuitive template syntax  
✅ **Flexible Config** - Works with explicit params or settings dicts  
✅ **Widget-Friendly** - Designed for widget configuration patterns  
✅ **Smart Defaults** - Sensible defaults with easy overrides  
✅ **Graceful Fallbacks** - Handles errors without breaking pages  
✅ **Full Featured** - Supports all imgproxy processing options  

Your images are now optimized and ready for production! 🚀

