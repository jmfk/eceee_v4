# High-Resolution Image Detection

## Overview

The high-resolution image detection system automatically identifies and serves the highest quality version of images during content import preview. This ensures imported content uses the best available image quality.

## Features

- **Automatic Detection**: Identifies high-res versions from srcset attributes and URL patterns
- **Visual Indicators**: Displays resolution badges (2×, 3×) on detected high-res images
- **Multiple Detection Methods**:
  - Srcset attributes with resolution descriptors
  - Common URL patterns (e.g., `-2x`, `@2x`, `-3x`)
  - Directory-based variants (`/large/`, `/original/`, `/hires/`)
  - Resolution indicators in filenames (`_1920`, `_2048`, `_3840`)
- **Metadata Preservation**: Passes srcset data through signed tokens for reliable detection

## Architecture

### Backend Components

#### 1. Token Signing Enhancement
**File**: `backend/content_import/utils/token_signing.py`

Enhanced to support optional metadata in signed tokens:
```python
sign_proxy_token(url, metadata={'srcset': [...]})
```

- Backward compatible with existing tokens
- Securely embeds srcset information for high-res detection
- Returns metadata when verifying tokens

#### 2. Image Resolution Utilities
**File**: `backend/content_import/utils/image_resolution.py`

Core utilities for resolution detection:

- `parse_srcset()`: Parse HTML srcset attributes
- `generate_resolution_variants()`: Generate URL variants to check
- `check_url_exists()`: Verify URL availability with HEAD requests
- `get_image_dimensions()`: Extract image dimensions from bytes
- `find_highest_resolution()`: Main algorithm to find best resolution

**URL Pattern Detection:**
```python
# For image.jpg, checks:
- image-2x.jpg, image@2x.jpg, image-3x.jpg, image@3x.jpg
- /large/image.jpg, /original/image.jpg, /hires/image.jpg
- image_1920.jpg, image_2048.jpg, image_3840.jpg
```

#### 3. Proxy Service Updates
**File**: `backend/content_import/services/proxy_service.py`

Enhanced to extract and pass srcset metadata:

- Extracts srcset data from `<img>` tags
- Converts relative URLs to absolute
- Passes metadata through `sign_proxy_token()`
- Injects resolution indicator UI into iframe

**Injected Scripts:**
- CSS for resolution badges
- JavaScript to detect and display resolution indicators
- MutationObserver for dynamically loaded images

#### 4. Proxy Asset View Enhancement
**File**: `backend/content_import/views/proxy.py`

Core resolution detection and serving logic:

```python
def get(self, request):
    # Validate token and extract metadata
    metadata = verify_proxy_token(url, token)
    
    # For images, find highest resolution
    if is_image:
        resolution_info = find_highest_resolution(
            base_url=url,
            srcset=metadata.get('srcset'),
            check_patterns=True
        )
        final_url = resolution_info['url']
    
    # Serve with custom headers
    response['X-Image-Resolution'] = '2x'
    response['X-Resolution-Source'] = 'srcset'
    response['X-Image-Dimensions'] = '1920x1080'
```

### Frontend Components

#### 1. Resolution Indicator Component
**File**: `frontend/src/components/import/ResolutionIndicator.jsx`

React component for displaying resolution badges:

```jsx
<ResolutionIndicator 
  multiplier={2.0} 
  source="srcset" 
  dimensions="1920x1080"
/>
```

Features:
- Color-coded badges (green for 3×, blue for 2×)
- Icon indicators (📱 for srcset, 🔍 for URL patterns)
- Tooltip with detailed information

#### 2. Iframe Integration
**Injected via ProxyService:**

The resolution detection UI is automatically injected into proxied pages:

```javascript
// Detects resolution headers
fetch(img.src, { method: 'HEAD' })
  .then(response => {
    const resolution = response.headers.get('X-Image-Resolution');
    if (resolution && resolution !== '1x') {
      // Display badge
    }
  });
```

Features:
- Automatic detection on page load
- MutationObserver for dynamic images
- Delayed retry for lazy-loaded images

## Response Headers

Custom headers added to proxy asset responses:

| Header | Example | Description |
|--------|---------|-------------|
| `X-Image-Resolution` | `2x`, `3x` | Resolution multiplier |
| `X-Resolution-Source` | `srcset`, `url-pattern-retina-suffix` | How it was detected |
| `X-Image-Dimensions` | `1920x1080` | Image dimensions (width×height) |
| `Access-Control-Expose-Headers` | (list) | Allows frontend to read headers |

## Detection Algorithm

1. **Collect Candidates**:
   - Original URL (1x baseline)
   - URLs from srcset attribute (highest priority)
   - Generated URL pattern variants (medium priority)

2. **Verify Availability**:
   - Send HEAD requests to check existence
   - Collect file sizes for comparison

3. **Select Best**:
   - Sort by resolution multiplier (highest first)
   - Then by file size (largest first)
   - Return highest available resolution

4. **Serve and Annotate**:
   - Fetch the selected high-res version
   - Extract dimensions if needed
   - Add custom response headers

## Visual Indicators

Resolution badges appear in the top-right corner of images:

- **Green badge (3×)**: 3x or higher resolution detected
- **Blue badge (2×)**: 2x resolution detected
- **No badge**: Standard 1x resolution

Badge format: `[icon] [multiplier]×`
- 📱 = Detected from srcset
- 🔍 = Detected from URL pattern

## Usage

### During Import Preview

1. User enters URL in import dialog
2. Proxy service fetches and rewrites page
3. Images load through proxy-asset endpoint
4. High-res detection runs automatically
5. Visual badges appear on high-res images
6. Console logs show detection results

### Example Console Output

```
🖼️  High-res image detected: 2x from srcset
🖼️  High-res image detected: 3x from url-pattern-retina-suffix
```

## Performance Considerations

- **HEAD Requests**: Only metadata is fetched to check availability
- **Max Checks Limit**: Default 10 URLs checked per image
- **Caching**: Future enhancement - cache detection results
- **Parallel Checks**: URL variants checked concurrently
- **Timeout**: 5 seconds for HEAD requests, 30 seconds for image fetch

## Configuration

Settings in `backend/config/settings.py`:

```python
# Token expiry for proxy assets (default: 1 hour)
CONTENT_IMPORT_PROXY_TOKEN_MAX_AGE = 3600
```

## Testing

Test with various image sources:

1. **Srcset Images**: Pages with responsive images
2. **Retina Images**: URLs with `-2x`, `@2x` suffixes
3. **Directory Variants**: `/original/`, `/large/` paths
4. **Mixed Content**: Combination of detection methods

Example test URLs:
- Sites with responsive images (srcset)
- Photography sites (often have retina variants)
- News sites (multiple size directories)

## Future Enhancements

- [ ] Cache detection results to avoid repeated checks
- [ ] Support for width-based srcset descriptors (e.g., `1024w`)
- [ ] User preference for max resolution
- [ ] Detection result analytics and reporting
- [ ] Support for picture element with multiple sources
- [ ] WebP format detection and preference

## Files Modified

### Backend
- `backend/content_import/utils/token_signing.py` - Token metadata support
- `backend/content_import/utils/image_resolution.py` - Detection utilities (new)
- `backend/content_import/services/proxy_service.py` - Srcset extraction and UI injection
- `backend/content_import/views/proxy.py` - High-res serving logic

### Frontend
- `frontend/src/components/import/ResolutionIndicator.jsx` - Badge component (new)

## Dependencies

### Python
- `Pillow` - Image dimension extraction
- `requests` - HTTP requests for URL checking
- `BeautifulSoup4` - HTML parsing (existing)

### JavaScript (Injected)
- Native Fetch API - Header reading
- MutationObserver - Dynamic image detection
- No additional npm packages required

## Technical Notes

### Security

- Signed tokens prevent unauthorized access
- Token expiry limits exposure window
- Metadata embedded in signed payload prevents tampering

### Compatibility

- Backward compatible with existing proxy tokens
- Works with all image formats except SVG (which doesn't benefit from resolution detection)
- No breaking changes to existing import workflow

### Browser Support

- Modern browsers with Fetch API support
- Response header reading via `response.headers.get()`
- MutationObserver for dynamic content

## Troubleshooting

### Images not showing badges

1. Check browser console for errors
2. Verify images are loading through proxy-asset endpoint
3. Check response headers in Network tab
4. Ensure JavaScript execution is enabled

### Wrong resolution selected

1. Check console logs for detection algorithm output
2. Verify URL patterns match expected conventions
3. Check if srcset data is being extracted correctly
4. Review HEAD request responses for availability

### Performance issues

1. Check number of URL variants being generated
2. Reduce `max_checks` parameter if needed
3. Verify timeout settings are appropriate
4. Consider adding result caching

