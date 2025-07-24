"""
CSS Validation and Security System for Dynamic CSS Injection

This module provides secure CSS validation, sanitization, and scoping
to prevent XSS attacks and ensure CSS safety in the dynamic injection system.
"""

import re
import hashlib
from typing import Dict, List, Tuple, Optional
from django.core.exceptions import ValidationError
from django.utils.safestring import mark_safe
import logging

logger = logging.getLogger(__name__)


class CSSSecurityError(Exception):
    """Exception raised when CSS content contains security risks"""

    pass


class CSSValidator:
    """
    Comprehensive CSS validation and security system.

    Validates CSS content for security risks, syntax errors, and compliance
    with security policies for dynamic CSS injection.
    """

    # Dangerous CSS patterns that should be blocked
    DANGEROUS_PATTERNS = [
        r"javascript\s*:",  # JavaScript URLs
        r"expression\s*\(",  # IE expression() function
        r'@import\s+["\'](?!https?://)',  # Local @import (allow external HTTPS)
        r'url\s*\(\s*["\']?javascript:',  # JavaScript in url()
        r"vbscript\s*:",  # VBScript URLs
        r"data\s*:\s*text/html",  # HTML in data URLs
        r"<script",  # Script tags in CSS
        r"</script>",  # Script tag closures
        r"onload\s*=",  # Event handlers
        r"onerror\s*=",  # Error handlers
        r"eval\s*\(",  # eval() function
        r"Function\s*\(",  # Function constructor
        r"-moz-binding",  # Firefox XBL binding
        r"behavior\s*:",  # IE behavior property
    ]

    # CSS functions that are allowed
    ALLOWED_CSS_FUNCTIONS = [
        "var(",
        "calc(",
        "rgba(",
        "rgb(",
        "hsl(",
        "hsla(",
        "url(",
        "linear-gradient(",
        "radial-gradient(",
        "repeating-linear-gradient(",
        "repeating-radial-gradient(",
        "rotate(",
        "scale(",
        "translate(",
        "translateX(",
        "translateY(",
        "translateZ(",
        "matrix(",
        "matrix3d(",
        "perspective(",
        "rotateX(",
        "rotateY(",
        "rotateZ(",
        "skew(",
        "skewX(",
        "skewY(",
        "scaleX(",
        "scaleY(",
        "scaleZ(",
    ]

    # Maximum CSS size limits
    MAX_CSS_SIZE = 100 * 1024  # 100KB max CSS size
    MAX_RULES = 1000  # Maximum number of CSS rules
    MAX_SELECTORS_PER_RULE = 50  # Maximum selectors per rule

    def __init__(self, strict_mode: bool = True):
        """
        Initialize CSS validator.

        Args:
            strict_mode: Whether to use strict validation rules
        """
        self.strict_mode = strict_mode
        self.warnings: List[str] = []
        self.errors: List[str] = []

    def validate_css(
        self, css_content: str, context: str = "unknown"
    ) -> Tuple[bool, List[str], List[str]]:
        """
        Validate CSS content for security and syntax.

        Args:
            css_content: The CSS content to validate
            context: Context description for error reporting

        Returns:
            Tuple of (is_valid, errors, warnings)
        """
        self.errors = []
        self.warnings = []

        if not css_content or not css_content.strip():
            return True, [], []

        # Size validation
        if len(css_content) > self.MAX_CSS_SIZE:
            self.errors.append(
                f"CSS content exceeds maximum size limit of {self.MAX_CSS_SIZE} bytes"
            )
            return False, self.errors, self.warnings

        # Security validation
        if not self._validate_security(css_content):
            return False, self.errors, self.warnings

        # Syntax validation
        if not self._validate_syntax(css_content):
            return False, self.errors, self.warnings

        # Structure validation
        if not self._validate_structure(css_content):
            return False, self.errors, self.warnings

        return True, self.errors, self.warnings

    def _validate_security(self, css_content: str) -> bool:
        """Validate CSS for security risks"""
        # Normalize content for pattern matching
        normalized_css = css_content.lower().replace("\n", " ").replace("\t", " ")

        # Check for dangerous patterns
        for pattern in self.DANGEROUS_PATTERNS:
            if re.search(pattern, normalized_css, re.IGNORECASE):
                self.errors.append(f"Security risk detected: {pattern}")
                return False

        # Check for suspicious URL patterns
        url_pattern = r'url\s*\(\s*["\']?([^"\']+)["\']?\s*\)'
        urls = re.findall(url_pattern, css_content, re.IGNORECASE)

        for url in urls:
            if not self._validate_url(url):
                self.errors.append(f"Suspicious URL detected: {url}")
                return False

        return True

    def _validate_url(self, url: str) -> bool:
        """Validate individual URLs in CSS"""
        url = url.strip()

        # Allow data URLs for images only
        if url.startswith("data:"):
            if not url.startswith("data:image/"):
                return False

        # Allow relative URLs
        if url.startswith("/") or url.startswith("./") or url.startswith("../"):
            return True

        # Allow HTTPS URLs
        if url.startswith("https://"):
            return True

        # Block other protocols in strict mode
        if self.strict_mode and ":" in url:
            return False

        return True

    def _validate_syntax(self, css_content: str) -> bool:
        """Basic CSS syntax validation"""
        # Check for balanced braces
        brace_count = css_content.count("{") - css_content.count("}")
        if brace_count != 0:
            self.errors.append(
                f"Unbalanced braces: {brace_count} unmatched opening braces"
            )
            return False

        # Check for balanced parentheses in functions
        paren_count = css_content.count("(") - css_content.count(")")
        if paren_count != 0:
            self.errors.append(
                f"Unbalanced parentheses: {paren_count} unmatched opening parentheses"
            )
            return False

        # Check for balanced quotes
        single_quotes = css_content.count("'")
        double_quotes = css_content.count('"')

        if single_quotes % 2 != 0:
            self.errors.append("Unmatched single quotes in CSS")
            return False

        if double_quotes % 2 != 0:
            self.errors.append("Unmatched double quotes in CSS")
            return False

        return True

    def _validate_structure(self, css_content: str) -> bool:
        """Validate CSS structure and complexity"""
        # Count CSS rules
        rule_count = css_content.count("{")
        if rule_count > self.MAX_RULES:
            self.errors.append(
                f"Too many CSS rules: {rule_count} (max: {self.MAX_RULES})"
            )
            return False

        # Check for excessive selector complexity
        rules = re.findall(r"([^{}]+)\s*{", css_content)
        for rule in rules:
            selectors = [s.strip() for s in rule.split(",") if s.strip()]
            if len(selectors) > self.MAX_SELECTORS_PER_RULE:
                self.warnings.append(
                    f"Rule has many selectors ({len(selectors)}): {rule[:50]}..."
                )

        return True

    def sanitize_css(self, css_content: str) -> str:
        """
        Sanitize CSS content by removing dangerous patterns.

        Args:
            css_content: Raw CSS content

        Returns:
            Sanitized CSS content
        """
        if not css_content:
            return ""

        sanitized = css_content

        # Remove dangerous patterns
        for pattern in self.DANGEROUS_PATTERNS:
            sanitized = re.sub(
                pattern,
                "/* REMOVED DANGEROUS CONTENT */",
                sanitized,
                flags=re.IGNORECASE,
            )

        # Remove comments that might contain dangerous content
        sanitized = re.sub(r"/\*.*?\*/", "", sanitized, flags=re.DOTALL)

        return sanitized.strip()


class CSSInjectionManager:
    """
    Manager for CSS injection with scoping, caching, and security.

    Handles the generation of scoped CSS, cache management, and
    secure injection of dynamic CSS content.
    """

    def __init__(self):
        self.validator = CSSValidator()
        self._css_cache: Dict[str, str] = {}

    def generate_css_scope_id(
        self,
        widget_id: Optional[str] = None,
        page_id: Optional[str] = None,
        slot_name: Optional[str] = None,
    ) -> str:
        """
        Generate a unique CSS scope identifier.

        Args:
            widget_id: Widget identifier
            page_id: Page identifier
            slot_name: Slot name

        Returns:
            Unique CSS scope identifier
        """
        scope_parts = []

        if page_id:
            scope_parts.append(f"page-{page_id}")
        if slot_name:
            scope_parts.append(f"slot-{slot_name}")
        if widget_id:
            scope_parts.append(f"widget-{widget_id}")

        scope_key = "-".join(scope_parts) if scope_parts else "global"

        # Create a hash for long identifiers
        if len(scope_key) > 50:
            scope_hash = hashlib.md5(scope_key.encode()).hexdigest()[:8]
            return f"css-{scope_hash}"

        return f"css-{scope_key}"

    def scope_css(
        self, css_content: str, scope_id: str, scope_type: str = "widget"
    ) -> str:
        """
        Apply CSS scoping to prevent style conflicts.

        Args:
            css_content: Original CSS content
            scope_id: Unique scope identifier
            scope_type: Type of scoping ('widget', 'page', 'slot', 'global')

        Returns:
            Scoped CSS content
        """
        if not css_content or scope_type == "global":
            return css_content

        # Generate scope selector
        scope_selector = f".{scope_id}"

        # Parse CSS rules and add scope
        scoped_css = []

        # Simple CSS rule parsing
        rules = re.findall(r"([^{}]+)\s*{([^{}]*)}", css_content)

        for selector_part, declarations in rules:
            selectors = [s.strip() for s in selector_part.split(",")]
            scoped_selectors = []

            for selector in selectors:
                if selector.strip():
                    # Add scope prefix to each selector
                    if selector.strip().startswith("@"):
                        # Handle at-rules (media queries, etc.)
                        scoped_selectors.append(selector)
                    else:
                        scoped_selectors.append(f"{scope_selector} {selector}")

            if scoped_selectors and declarations.strip():
                scoped_rule = f"{', '.join(scoped_selectors)} {{ {declarations} }}"
                scoped_css.append(scoped_rule)

        return "\n".join(scoped_css)

    def validate_and_inject_css(
        self,
        css_content: str,
        scope_id: str = None,
        scope_type: str = "global",
        context: str = "unknown",
    ) -> Tuple[bool, str, List[str]]:
        """
        Validate, scope, and prepare CSS for injection.

        Args:
            css_content: Raw CSS content
            scope_id: CSS scope identifier
            scope_type: Type of CSS scoping
            context: Context for error reporting

        Returns:
            Tuple of (is_valid, processed_css, errors)
        """
        if not css_content:
            return True, "", []

        # Validate CSS
        is_valid, errors, warnings = self.validator.validate_css(css_content, context)

        if not is_valid:
            return False, "", errors

        # Sanitize CSS
        sanitized_css = self.validator.sanitize_css(css_content)

        # Apply scoping if needed
        if scope_id and scope_type != "global":
            scoped_css = self.scope_css(sanitized_css, scope_id, scope_type)
        else:
            scoped_css = sanitized_css

        # Cache processed CSS
        cache_key = self._generate_cache_key(css_content, scope_id, scope_type)
        self._css_cache[cache_key] = scoped_css

        return True, scoped_css, warnings

    def _generate_cache_key(
        self, css_content: str, scope_id: str = None, scope_type: str = "global"
    ) -> str:
        """Generate cache key for CSS content"""
        content_hash = hashlib.md5(css_content.encode()).hexdigest()
        return f"{content_hash}-{scope_id or 'none'}-{scope_type}"

    def clear_cache(self):
        """Clear CSS cache"""
        self._css_cache.clear()

    def get_cached_css(self, cache_key: str) -> Optional[str]:
        """Get cached CSS by key"""
        return self._css_cache.get(cache_key)


# Global CSS injection manager instance
css_injection_manager = CSSInjectionManager()
