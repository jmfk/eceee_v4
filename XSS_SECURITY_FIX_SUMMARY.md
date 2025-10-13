# XSS Security Vulnerability Fix - Summary

## Overview
Fixed critical XSS (Cross-Site Scripting) vulnerabilities across the application by implementing proper HTML sanitization while maintaining flexibility for trusted content.

## Changes Made

### 1. Added HTML Sanitization Library
- **File**: `backend/requirements.txt`
- **Change**: Added `bleach>=6.0.0` - Industry-standard HTML sanitization library
- **Purpose**: Provides configurable HTML cleaning with safe allowlists

### 2. Created Custom Sanitization Filter
- **Files**: 
  - `backend/utils/templatetags/__init__.py` (new)
  - `backend/utils/templatetags/security_filters.py` (new)
  
- **Features**:
  - `sanitize_html` filter that strips malicious code while preserving legitimate HTML
  - Configurable allowlist of safe HTML tags, attributes, and URL protocols
  - Optional `allow_scripts` parameter to bypass sanitization for trusted content
  - Defense-in-depth protection against `javascript:` URLs
  - Legacy `strip_scripts` filter for backward compatibility

- **Allowed HTML Elements**:
  - **Tags**: `a, abbr, article, aside, b, blockquote, br, code, div, em, h1-h6, hr, i, img, li, ol, p, pre, section, span, strong, table, tbody, td, th, thead, tr, ul, figure, figcaption, caption, dl, dt, dd, sub, sup, small, mark, del, ins, cite, q, kbd, samp, var, time, address`
  - **Attributes**: `class, id, title, data-*, href, src, alt, width, height, loading, colspan, rowspan, align, valign, scope, border, cellpadding, cellspacing, start, type, value, cite, datetime`
  - **URL Protocols**: `http, https, mailto, tel` (blocks `javascript:`, `data:`, etc.)

### 3. Updated Templates to Use Sanitization

#### High Priority - User-Generated Content
- **`backend/eceee_widgets/templates/eceee_widgets/widgets/news_detail.html`**
  - Line 53: `{{ content_html|safe }}` → `{{ content_html|sanitize_html }}`
  - Line 61: `{{ widget_html|safe }}` → `{{ widget_html|sanitize_html }}`
  - Always sanitizes news content (no `allow_scripts` option)

- **`backend/default_widgets/templates/default_widgets/widgets/content.html`**
  - Simplified from conditional logic to: `{{ config.content|sanitize_html:config.allow_scripts }}`
  - Respects widget's `allow_scripts` configuration

- **`backend/default_widgets/templates/default_widgets/widgets/html_block.html`**
  - Changed from `striptags` to proper sanitization: `{{ config.html_content|sanitize_html:config.allow_scripts }}`

- **`backend/default_widgets/templates/default_widgets/widgets/news.html`**
  - Line 27: `{{ config.content|safe }}` → `{{ config.content|sanitize_html }}`

#### Widget Templates
- **`backend/default_widgets/templates/default_widgets/widgets/two_columns.html`**
  - Lines 8, 22: Sanitizes rendered widget HTML in both columns

- **`backend/default_widgets/templates/default_widgets/widgets/sidebar.html`**
  - Lines 38, 64: Sanitizes sidebar section content and fallback content

- **`backend/default_widgets/templates/default_widgets/widgets/header.html`**
  - Line 17: Sanitizes header content

- **`backend/default_widgets/templates/default_widgets/widgets/footer.html`**
  - Line 6: Sanitizes footer content

- **`backend/default_widgets/templates/default_widgets/widgets/navigation.html`**
  - Line 73: Sanitizes fallback navigation content

- **`backend/default_widgets/templates/default_widgets/widgets/table.html`**
  - Lines 37, 56: Sanitizes table cell content

**Note**: CSS fields in `<style>` tags and JSON data in `<script type="application/json">` tags were left as-is for functionality, but are noted for potential future enhancement.

### 4. Comprehensive Test Suite
- **File**: `backend/utils/tests/test_security_filters.py`
- **Coverage**:
  - Tests for safe HTML preservation (paragraphs, headings, lists, tables, links, images)
  - Tests for malicious code removal (scripts, event handlers, javascript: URLs)
  - Tests for CSS expression attacks
  - Tests for `allow_scripts` parameter (True/False, string values)
  - Tests for edge cases (empty strings, None, nested tags)
  - Tests for complex XSS attempts
  - Tests for template integration
  - Tests for legacy `strip_scripts` filter

## Security Benefits

### What's Blocked
- `<script>` tags and inline JavaScript
- Event handlers: `onclick`, `onerror`, `onload`, etc.
- `javascript:` URLs in links and other attributes
- Dangerous CSS expressions
- `<iframe>`, `<object>`, `<embed>` tags
- Other potentially dangerous HTML elements

### What's Preserved
- Legitimate HTML formatting (bold, italic, headings, paragraphs)
- Safe links (http, https, mailto, tel)
- Images with safe URLs
- Tables and lists
- Semantic HTML5 elements
- CSS classes and IDs for styling

### Flexible Security Model
- **Default**: All content is sanitized
- **Widget Configuration**: Widgets with `allow_scripts=True` can bypass sanitization for trusted admin content
- **News Widgets**: Always sanitize (no bypass option) since content may come from external sources

## Testing the Fix

### Manual Testing
1. Install the new dependency:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. Test with malicious content:
   ```html
   <p>Safe content</p><script>alert('XSS')</script>
   ```
   Expected: Only the paragraph renders, script is removed

3. Test with safe formatting:
   ```html
   <h1>Title</h1><p>Content with <strong>bold</strong> and <em>italic</em></p>
   ```
   Expected: All formatting is preserved

### Automated Testing
```bash
cd backend
python manage.py test utils.tests.test_security_filters
```

## Migration Notes

### For Developers
- All templates now require `{% load security_filters %}` at the top
- Replace `{{ content|safe }}` with `{{ content|sanitize_html }}`
- For trusted content with scripts, use `{{ content|sanitize_html:config.allow_scripts }}`

### For Content Editors
- HTML content will be automatically sanitized
- Most formatting will work normally
- JavaScript and event handlers will be removed for security
- Widgets with "Allow Scripts" option can be used for trusted admin content

### Breaking Changes
- **None for end users**: Content display will be the same or safer
- **For widgets with embedded scripts**: If a widget legitimately needs scripts, ensure it has an `allow_scripts` config option

## Files Modified

### New Files
1. `backend/utils/templatetags/__init__.py`
2. `backend/utils/templatetags/security_filters.py`
3. `backend/utils/tests/__init__.py`
4. `backend/utils/tests/test_security_filters.py`

### Modified Files
1. `backend/requirements.txt`

**eceee_widgets templates (7 files):**
2. `backend/eceee_widgets/templates/eceee_widgets/widgets/news_detail.html`
3. `backend/eceee_widgets/templates/eceee_widgets/widgets/content.html`
4. `backend/eceee_widgets/templates/eceee_widgets/widgets/html_block.html`
5. `backend/eceee_widgets/templates/eceee_widgets/widgets/sidebar.html`
6. `backend/eceee_widgets/templates/eceee_widgets/widgets/footer.html`
7. `backend/eceee_widgets/templates/eceee_widgets/widgets/three_columns.html`
8. `backend/eceee_widgets/templates/eceee_widgets/widgets/two_column.html`
9. `backend/eceee_widgets/templates/eceee_widgets/widgets/table.html`

**default_widgets templates (9 files):**
10. `backend/default_widgets/templates/default_widgets/widgets/content.html`
11. `backend/default_widgets/templates/default_widgets/widgets/html_block.html`
12. `backend/default_widgets/templates/default_widgets/widgets/news.html`
13. `backend/default_widgets/templates/default_widgets/widgets/two_columns.html`
14. `backend/default_widgets/templates/default_widgets/widgets/sidebar.html`
15. `backend/default_widgets/templates/default_widgets/widgets/header.html`
16. `backend/default_widgets/templates/default_widgets/widgets/footer.html`
17. `backend/default_widgets/templates/default_widgets/widgets/navigation.html`
18. `backend/default_widgets/templates/default_widgets/widgets/table.html`

## Security Compliance
This fix addresses:
- **OWASP Top 10**: A03:2021 – Injection (XSS)
- **CWE-79**: Improper Neutralization of Input During Web Page Generation
- **Django Security Best Practices**: Proper HTML escaping and sanitization

## Next Steps
1. **Deploy**: Install bleach dependency and restart the application
2. **Test**: Run automated tests to verify functionality
3. **Monitor**: Watch for any rendering issues with existing content
4. **Document**: Update developer documentation with sanitization guidelines
5. **Future Enhancement**: Consider adding CSS sanitization for `<style>` tags

