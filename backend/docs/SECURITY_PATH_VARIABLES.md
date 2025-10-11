# Path Variables Security Documentation

## Overview

Path variables are extracted from URL patterns and made available to widget templates through the `_context.path_variables` dictionary. This document explains the security measures in place and best practices for using path variables safely.

## Security Measures

### Automatic HTML Escaping

**All path variables are automatically HTML-escaped** when extracted from URL patterns. This happens in the `_extract_path_variables()` method in `backend/webpages/public_views.py`.

```python
# After pattern matching, all values are HTML-escaped
variables = {key: escape(str(value)) for key, value in variables.items()}
```

### Why HTML Escaping?

1. **Defense-in-Depth**: While Django templates auto-escape by default, escaping at the source provides an additional layer of security.

2. **Protection Against Permissive Patterns**: If developers create custom path patterns that allow special characters, the escaping ensures these can't be exploited for XSS attacks.

3. **Safe for All Contexts**: Even if templates use the `|safe` filter or raw rendering, the path variables remain safe.

### Characters That Are Escaped

The following HTML special characters are automatically escaped:

- `<` becomes `&lt;`
- `>` becomes `&gt;`
- `&` becomes `&amp;`
- `'` becomes `&#x27;`
- `"` becomes `&quot;`

## Using Path Variables in Templates

### Standard Usage (Recommended)

In Django templates, simply use the double-brace syntax. The values are already HTML-safe:

```html
<!-- Widget template example -->
<div class="article-slug">
    {{ config._context.path_variables.slug }}
</div>
```

### Accessing Path Variables

Path variables are available in widget templates through the `_context` object:

```python
# In a widget's prepare_template_context method
path_variables = context.get("path_variables", {})

# These will already be HTML-escaped
slug = path_variables.get("slug", "")
year = path_variables.get("year", "")
```

### DO NOT Double-Escape

Since path variables are already HTML-escaped, **do not** use Django's `escape` filter:

```html
<!-- WRONG - will double-escape -->
{{ config._context.path_variables.slug|escape }}

<!-- CORRECT - already escaped -->
{{ config._context.path_variables.slug }}
```

### Using in Attributes

Path variables are safe to use in HTML attributes:

```html
<div data-slug="{{ config._context.path_variables.slug }}" 
     data-year="{{ config._context.path_variables.year }}">
    ...
</div>
```

### Using in URLs

For URL construction, path variables are already safe:

```html
<a href="/articles/{{ config._context.path_variables.slug }}/">
    View Article
</a>
```

### JavaScript Context

If you need to use path variables in JavaScript, use Django's `escapejs` filter:

```html
<script>
    const slug = "{{ config._context.path_variables.slug|escapejs }}";
    console.log(slug);
</script>
```

Or better yet, use data attributes and read them with JavaScript:

```html
<div id="article" 
     data-slug="{{ config._context.path_variables.slug }}">
</div>

<script>
    const slug = document.getElementById('article').dataset.slug;
    console.log(slug);
</script>
```

## Creating Custom Path Patterns

### Security Guidelines

When creating custom path patterns, follow these security best practices:

#### 1. Use Restrictive Regex Patterns

**Good** - Restrictive pattern that only matches safe characters:
```python
class NewsSlugPattern(BasePathPattern):
    key = "news_slug"
    regex_pattern = r"^(?P<slug>[\w-]+)/$"  # Only word chars and hyphens
```

**Bad** - Overly permissive pattern:
```python
class BadPattern(BasePathPattern):
    key = "bad_pattern"
    regex_pattern = r"^(?P<slug>.+)/$"  # Matches any character!
```

#### 2. Use Named Capture Groups

Always use named capture groups for better security and maintainability:

```python
# Good
regex_pattern = r"^(?P<year>\d{4})/(?P<slug>[\w-]+)/$"

# Bad
regex_pattern = r"^(\d{4})/([\w-]+)/$"  # Unnamed groups
```

#### 3. Validate Expected Format

Design patterns that validate the expected format:

```python
class DateSlugPattern(BasePathPattern):
    key = "date_slug"
    # Validates year (4 digits), month (2 digits), slug (word chars only)
    regex_pattern = r"^(?P<year>\d{4})/(?P<month>\d{2})/(?P<slug>[\w-]+)/$"
```

#### 4. Document Extracted Variables

Always document what variables your pattern extracts:

```python
class EventPattern(BasePathPattern):
    key = "event_slug"
    name = "Event Slug"
    description = "Matches event URLs with a slug"
    regex_pattern = r"^(?P<slug>[\w-]+)/$"
    example_url = "summer-conference-2025/"
    
    extracted_variables = [
        {
            "name": "slug",
            "type": "string",
            "description": "URL-safe event identifier",
            "example": "summer-conference-2025"
        }
    ]
```

## Common Patterns

### Safe Patterns (Recommended)

These patterns are secure and should be used as templates:

1. **Simple Slug**: `^(?P<slug>[\w-]+)/$`
   - Matches: `my-article/`, `event-2025/`
   - Variables: `slug`

2. **Year + Slug**: `^(?P<year>\d{4})/(?P<slug>[\w-]+)/$`
   - Matches: `2025/annual-report/`
   - Variables: `year`, `slug`

3. **Date + Slug**: `^(?P<year>\d{4})/(?P<month>\d{2})/(?P<slug>[\w-]+)/$`
   - Matches: `2025/10/my-article/`
   - Variables: `year`, `month`, `slug`

4. **Numeric ID**: `^(?P<id>\d+)/$`
   - Matches: `12345/`
   - Variables: `id`

5. **Category + Slug**: `^(?P<category>[\w-]+)/(?P<slug>[\w-]+)/$`
   - Matches: `technology/energy-efficiency/`
   - Variables: `category`, `slug`

## Testing

### Security Test Cases

The test suite includes comprehensive security tests in `backend/webpages/tests/test_path_pattern_resolution.py`:

- `test_path_variables_are_html_escaped()` - Verifies basic escaping
- `test_special_characters_are_escaped()` - Tests HTML special characters
- `test_xss_payload_is_neutralized()` - Tests XSS attack vectors
- `test_multiple_path_variables_all_escaped()` - Tests multi-variable patterns

### Running Security Tests

```bash
# Run all path pattern tests
python manage.py test webpages.tests.test_path_pattern_resolution

# Run only security tests
python manage.py test webpages.tests.test_path_pattern_resolution.PathVariableSecurityTests
```

## Security Checklist

When implementing features that use path variables:

- [ ] Path variables are accessed through `config._context.path_variables`
- [ ] Templates use standard Django syntax (`{{ variable }}`) without extra escaping
- [ ] Custom path patterns use restrictive regex (prefer `[\w-]+` over `.+`)
- [ ] Path patterns use named capture groups
- [ ] JavaScript usage employs `escapejs` filter or data attributes
- [ ] Security tests verify XSS protection

## Reporting Security Issues

If you discover a security vulnerability related to path variables or any other aspect of the system, please:

1. **Do not** create a public GitHub issue
2. Contact the security team directly
3. Provide details about the vulnerability and how to reproduce it
4. Allow time for a fix before public disclosure

## Additional Resources

- [Django Template Auto-escaping](https://docs.djangoproject.com/en/stable/ref/templates/language/#automatic-html-escaping)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Django Security](https://docs.djangoproject.com/en/stable/topics/security/)

## Version History

- **2025-10-11**: Initial documentation - Added automatic HTML escaping for path variables

