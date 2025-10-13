"""
Tests for security-focused template filters
"""

import pytest
from django.template import Context, Template
from utils.templatetags.security_filters import sanitize_html


class TestSanitizeHtmlFilter:
    """Test the sanitize_html template filter"""

    def test_allows_safe_html_tags(self):
        """Test that safe HTML tags are preserved"""
        html = "<p>This is a <strong>test</strong> with <em>formatting</em>.</p>"
        result = sanitize_html(html)
        assert "<p>" in result
        assert "<strong>" in result
        assert "<em>" in result
        assert "test" in result

    def test_removes_script_tags(self):
        """Test that script tags are removed"""
        html = '<p>Safe content</p><script>alert("XSS")</script>'
        result = sanitize_html(html)
        assert "<p>" in result
        assert "Safe content" in result
        assert "<script>" not in result
        assert 'alert("XSS")' not in result

    def test_removes_onclick_handlers(self):
        """Test that onclick and other event handlers are removed"""
        html = '<a href="#" onclick="alert(\'XSS\')">Click me</a>'
        result = sanitize_html(html)
        assert "<a" in result
        assert "onclick" not in result
        assert "alert" not in result.lower() or "<script" not in result.lower()

    def test_removes_onerror_handlers(self):
        """Test that onerror handlers are removed"""
        html = '<img src="x" onerror="alert(\'XSS\')">'
        result = sanitize_html(html)
        assert "<img" in result
        assert "onerror" not in result
        assert "alert" not in result.lower()

    def test_removes_javascript_urls(self):
        """Test that javascript: URLs are removed"""
        html = "<a href=\"javascript:alert('XSS')\">Click</a>"
        result = sanitize_html(html)
        # The link should either be removed or have javascript: stripped
        assert "javascript:" not in result.lower()

    def test_allows_safe_links(self):
        """Test that safe HTTP/HTTPS links are preserved"""
        html = '<a href="https://example.com">Example</a>'
        result = sanitize_html(html)
        assert "https://example.com" in result
        assert "<a" in result

    def test_allows_images(self):
        """Test that images with safe URLs are preserved"""
        html = '<img src="https://example.com/image.jpg" alt="Test">'
        result = sanitize_html(html)
        assert "<img" in result
        assert "https://example.com/image.jpg" in result
        assert 'alt="Test"' in result

    def test_allows_headings(self):
        """Test that heading tags are preserved"""
        html = "<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>"
        result = sanitize_html(html)
        assert "<h1>" in result
        assert "<h2>" in result
        assert "<h3>" in result

    def test_allows_lists(self):
        """Test that lists are preserved"""
        html = "<ul><li>Item 1</li><li>Item 2</li></ul>"
        result = sanitize_html(html)
        assert "<ul>" in result
        assert "<li>" in result

    def test_allows_tables(self):
        """Test that tables are preserved"""
        html = """
        <table>
            <thead><tr><th>Header</th></tr></thead>
            <tbody><tr><td>Data</td></tr></tbody>
        </table>
        """
        result = sanitize_html(html)
        assert "<table>" in result
        assert "<thead>" in result
        assert "<tbody>" in result
        assert "<tr>" in result
        assert "<th>" in result
        assert "<td>" in result

    def test_allows_classes_and_ids(self):
        """Test that class and id attributes are preserved"""
        html = '<div class="container" id="main">Content</div>'
        result = sanitize_html(html)
        assert 'class="container"' in result
        assert 'id="main"' in result

    def test_removes_style_with_expression(self):
        """Test that dangerous CSS expressions are handled"""
        html = "<div style=\"background: expression(alert('XSS'))\">Content</div>"
        result = sanitize_html(html)
        # Style attribute should be removed by bleach's default config
        assert "expression" not in result.lower()

    def test_bypasses_sanitization_when_allow_scripts_true(self):
        """Test that allow_scripts=True bypasses sanitization"""
        html = '<script>alert("XSS")</script><p>Content</p>'
        result = sanitize_html(html, allow_scripts=True)
        # When allow_scripts is True, content should pass through unchanged
        assert "<script>" in result
        assert 'alert("XSS")' in result

    def test_sanitizes_when_allow_scripts_false(self):
        """Test that allow_scripts=False applies sanitization"""
        html = '<script>alert("XSS")</script><p>Content</p>'
        result = sanitize_html(html, allow_scripts=False)
        assert "<script>" not in result
        assert "<p>" in result

    def test_handles_string_allow_scripts_parameter(self):
        """Test that string 'true'/'false' values work for allow_scripts"""
        html = '<script>alert("XSS")</script>'

        result_true = sanitize_html(html, allow_scripts="true")
        assert "<script>" in result_true

        result_false = sanitize_html(html, allow_scripts="false")
        assert "<script>" not in result_false

    def test_handles_empty_string(self):
        """Test that empty strings are handled gracefully"""
        result = sanitize_html("")
        assert result == ""

    def test_handles_none(self):
        """Test that None is handled gracefully"""
        result = sanitize_html(None)
        assert result == ""

    def test_preserves_text_content(self):
        """Test that plain text is preserved"""
        text = "This is plain text without HTML tags."
        result = sanitize_html(text)
        assert text in result

    def test_nested_tags(self):
        """Test that nested safe tags are preserved"""
        html = "<div><p>This is <strong>nested <em>content</em></strong>.</p></div>"
        result = sanitize_html(html)
        assert "<div>" in result
        assert "<p>" in result
        assert "<strong>" in result
        assert "<em>" in result

    def test_removes_iframe(self):
        """Test that iframe tags are removed"""
        html = '<iframe src="https://evil.com"></iframe><p>Content</p>'
        result = sanitize_html(html)
        assert "<iframe" not in result
        assert "<p>" in result

    def test_removes_object_embed(self):
        """Test that object and embed tags are removed"""
        html = '<object data="evil.swf"></object><embed src="evil.swf"><p>Content</p>'
        result = sanitize_html(html)
        assert "<object" not in result
        assert "<embed" not in result
        assert "<p>" in result

    def test_complex_xss_attempt(self):
        """Test protection against complex XSS attempts"""
        html = """
        <div>
            <p>Safe content</p>
            <script>alert('XSS')</script>
            <img src=x onerror="alert('XSS')">
            <a href="javascript:alert('XSS')">Click</a>
            <div style="background: expression(alert('XSS'))">Text</div>
        </div>
        """
        result = sanitize_html(html)
        assert "<script>" not in result
        assert "onerror" not in result
        assert "javascript:" not in result.lower()
        assert "expression" not in result.lower()
        assert "Safe content" in result

    def test_allows_mailto_links(self):
        """Test that mailto: links are preserved"""
        html = '<a href="mailto:test@example.com">Email me</a>'
        result = sanitize_html(html)
        assert "mailto:test@example.com" in result
        assert "<a" in result


class TestSanitizeHtmlInTemplate:
    """Test the sanitize_html filter in Django templates"""

    def test_filter_in_template_without_parameter(self):
        """Test using the filter in a template without allow_scripts"""
        template = Template("{% load security_filters %}" "{{ content|sanitize_html }}")
        context = Context({"content": '<p>Safe</p><script>alert("XSS")</script>'})
        result = template.render(context)
        assert "<p>" in result
        assert "<script>" not in result

    def test_filter_in_template_with_false_parameter(self):
        """Test using the filter with allow_scripts=False"""
        template = Template(
            "{% load security_filters %}" "{{ content|sanitize_html:allow_scripts }}"
        )
        context = Context(
            {
                "content": '<p>Safe</p><script>alert("XSS")</script>',
                "allow_scripts": False,
            }
        )
        result = template.render(context)
        assert "<p>" in result
        assert "<script>" not in result

    def test_filter_in_template_with_true_parameter(self):
        """Test using the filter with allow_scripts=True"""
        template = Template(
            "{% load security_filters %}" "{{ content|sanitize_html:allow_scripts }}"
        )
        context = Context(
            {
                "content": '<p>Safe</p><script>console.log("trusted")</script>',
                "allow_scripts": True,
            }
        )
        result = template.render(context)
        assert "<p>" in result
        assert "<script>" in result

    def test_filter_with_config_object(self):
        """Test using the filter with a config object (like widget config)"""
        template = Template(
            "{% load security_filters %}"
            "{{ content|sanitize_html:config.allow_scripts }}"
        )

        class MockConfig:
            allow_scripts = False

        context = Context(
            {
                "content": '<p>Content</p><script>alert("XSS")</script>',
                "config": MockConfig(),
            }
        )
        result = template.render(context)
        assert "<p>" in result
        assert "<script>" not in result


class TestStripScriptsFilter:
    """Test the strip_scripts legacy filter"""

    def test_strip_scripts_filter(self):
        """Test that strip_scripts always sanitizes"""
        from utils.templatetags.security_filters import strip_scripts

        html = '<p>Safe</p><script>alert("XSS")</script>'
        result = strip_scripts(html)
        assert "<p>" in result
        assert "<script>" not in result
