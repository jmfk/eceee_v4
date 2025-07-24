"""
Comprehensive Template Validation System for HTML Layout Templates

This module provides a unified template validation system that combines:
- HTML structure and syntax validation
- CSS security and syntax validation
- Widget slot configuration validation
- Security scanning for XSS and injection attacks
- Performance analysis for template loading/rendering
- Accessibility compliance checking
- Real-time validation support
"""

import re
import time
import json
import logging
from typing import Dict, List, Any, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime

from django.core.exceptions import ValidationError
from django.template.loader import get_template
from django.template import TemplateDoesNotExist
from django.utils import timezone

from .css_validation import CSSValidator, CSSInjectionManager
from .layout_registry import SlotValidator, TemplateParsingError

logger = logging.getLogger(__name__)


class ValidationSeverity(Enum):
    """Validation issue severity levels"""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ValidationType(Enum):
    """Types of validation performed"""

    HTML_SYNTAX = "html_syntax"
    HTML_STRUCTURE = "html_structure"
    CSS_SYNTAX = "css_syntax"
    CSS_SECURITY = "css_security"
    SLOT_CONFIGURATION = "slot_configuration"
    SECURITY_SCAN = "security_scan"
    PERFORMANCE = "performance"
    ACCESSIBILITY = "accessibility"
    SEO = "seo"


@dataclass
class ValidationIssue:
    """Individual validation issue"""

    type: ValidationType
    severity: ValidationSeverity
    message: str
    line_number: Optional[int] = None
    column_number: Optional[int] = None
    element: Optional[str] = None
    context: Optional[str] = None
    suggestion: Optional[str] = None
    rule_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "type": self.type.value,
            "severity": self.severity.value,
            "message": self.message,
            "line_number": self.line_number,
            "column_number": self.column_number,
            "element": self.element,
            "context": self.context,
            "suggestion": self.suggestion,
            "rule_id": self.rule_id,
        }


@dataclass
class PerformanceMetrics:
    """Template performance analysis results"""

    parse_time_ms: float = 0.0
    dom_nodes: int = 0
    css_rules: int = 0
    slot_count: int = 0
    template_size_bytes: int = 0
    complexity_score: float = 0.0
    estimated_render_time_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "parse_time_ms": self.parse_time_ms,
            "dom_nodes": self.dom_nodes,
            "css_rules": self.css_rules,
            "slot_count": self.slot_count,
            "template_size_bytes": self.template_size_bytes,
            "complexity_score": self.complexity_score,
            "estimated_render_time_ms": self.estimated_render_time_ms,
        }


@dataclass
class ValidationResult:
    """Complete validation result"""

    is_valid: bool
    issues: List[ValidationIssue] = field(default_factory=list)
    performance_metrics: Optional[PerformanceMetrics] = None
    accessibility_score: Optional[float] = None
    security_score: Optional[float] = None
    seo_score: Optional[float] = None
    validation_time_ms: float = 0.0
    validated_at: datetime = field(default_factory=timezone.now)

    @property
    def error_count(self) -> int:
        """Count of error-level issues"""
        return len([i for i in self.issues if i.severity == ValidationSeverity.ERROR])

    @property
    def warning_count(self) -> int:
        """Count of warning-level issues"""
        return len([i for i in self.issues if i.severity == ValidationSeverity.WARNING])

    @property
    def critical_count(self) -> int:
        """Count of critical-level issues"""
        return len(
            [i for i in self.issues if i.severity == ValidationSeverity.CRITICAL]
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "is_valid": self.is_valid,
            "issues": [issue.to_dict() for issue in self.issues],
            "performance_metrics": (
                self.performance_metrics.to_dict() if self.performance_metrics else None
            ),
            "accessibility_score": self.accessibility_score,
            "security_score": self.security_score,
            "seo_score": self.seo_score,
            "error_count": self.error_count,
            "warning_count": self.warning_count,
            "critical_count": self.critical_count,
            "validation_time_ms": self.validation_time_ms,
            "validated_at": self.validated_at.isoformat(),
        }


class HTMLValidator:
    """HTML structure and syntax validation"""

    def __init__(self):
        self.issues: List[ValidationIssue] = []

    def validate(self, html_content: str) -> List[ValidationIssue]:
        """Validate HTML structure and syntax"""
        self.issues = []

        if not html_content or not html_content.strip():
            self.issues.append(
                ValidationIssue(
                    type=ValidationType.HTML_STRUCTURE,
                    severity=ValidationSeverity.WARNING,
                    message="Template contains no HTML content",
                    rule_id="HTML001",
                )
            )
            return self.issues

        try:
            from bs4 import BeautifulSoup
        except ImportError:
            self.issues.append(
                ValidationIssue(
                    type=ValidationType.HTML_SYNTAX,
                    severity=ValidationSeverity.ERROR,
                    message="BeautifulSoup4 is required for HTML validation",
                    suggestion="Install with: pip install beautifulsoup4",
                    rule_id="HTML002",
                )
            )
            return self.issues

        try:
            soup = BeautifulSoup(html_content, "html.parser")

            # Check for basic HTML structure
            self._validate_html_structure(soup, html_content)

            # Check for semantic HTML usage
            self._validate_semantic_html(soup)

            # Check for potential issues
            self._validate_html_best_practices(soup)

        except Exception as e:
            self.issues.append(
                ValidationIssue(
                    type=ValidationType.HTML_SYNTAX,
                    severity=ValidationSeverity.ERROR,
                    message=f"HTML parsing failed: {str(e)}",
                    rule_id="HTML003",
                )
            )

        return self.issues

    def _validate_html_structure(self, soup: "BeautifulSoup", html_content: str):
        """Validate basic HTML structure"""
        # Check for balanced tags
        open_tags = re.findall(r"<(\w+)[^>]*(?<!/)>", html_content)
        close_tags = re.findall(r"</(\w+)>", html_content)

        for tag in set(open_tags):
            open_count = open_tags.count(tag)
            close_count = close_tags.count(tag)

            # Skip void elements that don't need closing tags
            void_elements = {
                "img",
                "br",
                "hr",
                "input",
                "meta",
                "link",
                "area",
                "base",
                "col",
                "embed",
                "source",
                "track",
                "wbr",
            }
            if tag.lower() in void_elements:
                continue

            if open_count != close_count:
                self.issues.append(
                    ValidationIssue(
                        type=ValidationType.HTML_SYNTAX,
                        severity=ValidationSeverity.ERROR,
                        message=f"Unbalanced <{tag}> tags: {open_count} opening, {close_count} closing",
                        element=tag,
                        rule_id="HTML004",
                    )
                )

    def _validate_semantic_html(self, soup: "BeautifulSoup"):
        """Validate semantic HTML usage"""
        # Check for semantic elements
        semantic_elements = soup.find_all(
            ["main", "header", "footer", "nav", "section", "article", "aside"]
        )
        if not semantic_elements:
            self.issues.append(
                ValidationIssue(
                    type=ValidationType.HTML_STRUCTURE,
                    severity=ValidationSeverity.INFO,
                    message="Consider using semantic HTML5 elements (header, main, footer, nav, section, article)",
                    suggestion="Use semantic elements to improve accessibility and SEO",
                    rule_id="HTML005",
                )
            )

        # Check for missing alt attributes on images
        images = soup.find_all("img")
        for img in images:
            if not img.get("alt"):
                self.issues.append(
                    ValidationIssue(
                        type=ValidationType.ACCESSIBILITY,
                        severity=ValidationSeverity.WARNING,
                        message="Image missing alt attribute",
                        element="img",
                        context=str(img)[:100],
                        suggestion="Add alt attribute for accessibility",
                        rule_id="HTML006",
                    )
                )

    def _validate_html_best_practices(self, soup: "BeautifulSoup"):
        """Validate HTML best practices"""
        # Check for inline styles (should use CSS classes instead)
        elements_with_style = soup.find_all(attrs={"style": True})
        if elements_with_style:
            self.issues.append(
                ValidationIssue(
                    type=ValidationType.HTML_STRUCTURE,
                    severity=ValidationSeverity.WARNING,
                    message=f"Found {len(elements_with_style)} elements with inline styles",
                    suggestion="Use CSS classes instead of inline styles for better maintainability",
                    rule_id="HTML007",
                )
            )

        # Check for deprecated elements
        deprecated_elements = soup.find_all(["font", "center", "big", "small", "tt"])
        for element in deprecated_elements:
            self.issues.append(
                ValidationIssue(
                    type=ValidationType.HTML_STRUCTURE,
                    severity=ValidationSeverity.WARNING,
                    message=f"Deprecated HTML element: <{element.name}>",
                    element=element.name,
                    suggestion="Use CSS for styling instead of deprecated HTML elements",
                    rule_id="HTML008",
                )
            )


class SecurityScanner:
    """Security scanning for XSS and injection attacks"""

    def __init__(self):
        self.issues: List[ValidationIssue] = []

    def scan(self, html_content: str, css_content: str) -> List[ValidationIssue]:
        """Perform comprehensive security scan"""
        self.issues = []

        # Scan HTML for security issues
        self._scan_html_security(html_content)

        # Scan CSS for security issues (using existing CSSValidator)
        self._scan_css_security(css_content)

        # Check for mixed content
        self._scan_mixed_content(html_content)

        return self.issues

    def _scan_html_security(self, html_content: str):
        """Scan HTML for security vulnerabilities"""
        if not html_content:
            return

        # Check for script tags
        script_pattern = r"<script[^>]*>.*?</script>"
        scripts = re.findall(script_pattern, html_content, re.IGNORECASE | re.DOTALL)
        if scripts:
            self.issues.append(
                ValidationIssue(
                    type=ValidationType.SECURITY_SCAN,
                    severity=ValidationSeverity.CRITICAL,
                    message="Script tags detected in template",
                    context=f"Found {len(scripts)} script tags",
                    suggestion="Remove script tags and use external JS files",
                    rule_id="SEC001",
                )
            )

        # Check for event handlers
        event_handlers = [
            "onclick",
            "onload",
            "onerror",
            "onmouseover",
            "onsubmit",
            "onfocus",
            "onblur",
            "onchange",
            "onkeyup",
            "onkeydown",
        ]

        for handler in event_handlers:
            pattern = rf"{handler}\s*="
            if re.search(pattern, html_content, re.IGNORECASE):
                self.issues.append(
                    ValidationIssue(
                        type=ValidationType.SECURITY_SCAN,
                        severity=ValidationSeverity.ERROR,
                        message=f"Event handler detected: {handler}",
                        suggestion="Use external JavaScript event listeners instead",
                        rule_id="SEC002",
                    )
                )

        # Check for iframe tags
        iframe_pattern = r"<iframe[^>]*>.*?</iframe>"
        iframes = re.findall(iframe_pattern, html_content, re.IGNORECASE | re.DOTALL)
        if iframes:
            self.issues.append(
                ValidationIssue(
                    type=ValidationType.SECURITY_SCAN,
                    severity=ValidationSeverity.WARNING,
                    message="Iframe elements detected",
                    context=f"Found {len(iframes)} iframe elements",
                    suggestion="Ensure iframe sources are trusted and use sandbox attributes",
                    rule_id="SEC003",
                )
            )

        # Check for form elements without CSRF protection indicators
        form_pattern = r"<form[^>]*>"
        forms = re.findall(form_pattern, html_content, re.IGNORECASE)
        if forms:
            # Look for CSRF token patterns
            csrf_patterns = [r"csrf_token", r"csrfmiddlewaretoken", r"{% csrf_token %}"]
            has_csrf = any(
                re.search(pattern, html_content, re.IGNORECASE)
                for pattern in csrf_patterns
            )

            if not has_csrf:
                self.issues.append(
                    ValidationIssue(
                        type=ValidationType.SECURITY_SCAN,
                        severity=ValidationSeverity.WARNING,
                        message="Forms detected without CSRF protection",
                        suggestion="Ensure forms include CSRF tokens for security",
                        rule_id="SEC004",
                    )
                )

    def _scan_css_security(self, css_content: str):
        """Scan CSS for security issues using existing validator"""
        if not css_content:
            return

        validator = CSSValidator(strict_mode=True)
        is_valid, errors, warnings = validator.validate_css(
            css_content, "Security Scan"
        )

        if not is_valid:
            for error in errors:
                severity = (
                    ValidationSeverity.CRITICAL
                    if "security" in error.lower()
                    else ValidationSeverity.ERROR
                )
                self.issues.append(
                    ValidationIssue(
                        type=ValidationType.CSS_SECURITY,
                        severity=severity,
                        message=f"CSS security issue: {error}",
                        rule_id="SEC005",
                    )
                )

        for warning in warnings:
            self.issues.append(
                ValidationIssue(
                    type=ValidationType.CSS_SECURITY,
                    severity=ValidationSeverity.WARNING,
                    message=f"CSS security warning: {warning}",
                    rule_id="SEC006",
                )
            )

    def _scan_mixed_content(self, html_content: str):
        """Check for mixed content issues"""
        # Check for HTTP resources in HTTPS context
        http_pattern = r'(?:src|href|action)\s*=\s*["\']http://[^"\']*["\']'
        http_resources = re.findall(http_pattern, html_content, re.IGNORECASE)

        if http_resources:
            self.issues.append(
                ValidationIssue(
                    type=ValidationType.SECURITY_SCAN,
                    severity=ValidationSeverity.WARNING,
                    message="HTTP resources detected (mixed content)",
                    context=f"Found {len(http_resources)} HTTP resources",
                    suggestion="Use HTTPS URLs for all external resources",
                    rule_id="SEC007",
                )
            )


class PerformanceAnalyzer:
    """Template performance analysis"""

    def analyze(self, html_content: str, css_content: str) -> PerformanceMetrics:
        """Analyze template performance characteristics"""
        start_time = time.time()

        metrics = PerformanceMetrics()
        metrics.template_size_bytes = len(html_content.encode("utf-8")) + len(
            css_content.encode("utf-8")
        )

        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(html_content, "html.parser")

            # Count DOM nodes
            metrics.dom_nodes = len(soup.find_all())

            # Count CSS rules
            metrics.css_rules = css_content.count("{") if css_content else 0

            # Count widget slots
            slots = soup.find_all(attrs={"data-widget-slot": True})
            metrics.slot_count = len(slots)

            # Calculate complexity score
            metrics.complexity_score = self._calculate_complexity_score(metrics)

            # Estimate render time
            metrics.estimated_render_time_ms = self._estimate_render_time(metrics)

        except Exception as e:
            logger.warning(f"Performance analysis failed: {e}")

        metrics.parse_time_ms = (time.time() - start_time) * 1000
        return metrics

    def _calculate_complexity_score(self, metrics: PerformanceMetrics) -> float:
        """Calculate template complexity score (0-100)"""
        # Weight factors for different complexity components
        dom_weight = 0.4
        css_weight = 0.3
        slot_weight = 0.2
        size_weight = 0.1

        # Normalize each component (higher values = more complex)
        dom_score = min(metrics.dom_nodes / 100, 1.0) * 100
        css_score = min(metrics.css_rules / 50, 1.0) * 100
        slot_score = min(metrics.slot_count / 20, 1.0) * 100
        size_score = (
            min(metrics.template_size_bytes / 50000, 1.0) * 100
        )  # 50KB threshold

        return (
            dom_score * dom_weight
            + css_score * css_weight
            + slot_score * slot_weight
            + size_score * size_weight
        )

    def _estimate_render_time(self, metrics: PerformanceMetrics) -> float:
        """Estimate rendering time in milliseconds"""
        # Base time + time per DOM node + time per CSS rule + time per slot
        base_time = 5.0  # 5ms base
        dom_time = metrics.dom_nodes * 0.1  # 0.1ms per node
        css_time = metrics.css_rules * 0.2  # 0.2ms per rule
        slot_time = metrics.slot_count * 1.0  # 1ms per slot

        return base_time + dom_time + css_time + slot_time


class AccessibilityValidator:
    """Accessibility compliance validation"""

    def __init__(self):
        self.issues: List[ValidationIssue] = []

    def validate(self, html_content: str) -> Tuple[List[ValidationIssue], float]:
        """Validate accessibility compliance and return score"""
        self.issues = []

        if not html_content:
            return self.issues, 0.0

        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(html_content, "html.parser")

            # Run accessibility checks
            self._check_images(soup)
            self._check_forms(soup)
            self._check_headings(soup)
            self._check_links(soup)
            self._check_landmarks(soup)
            self._check_colors_and_contrast(html_content)

            # Calculate accessibility score
            score = self._calculate_accessibility_score()

        except Exception as e:
            self.issues.append(
                ValidationIssue(
                    type=ValidationType.ACCESSIBILITY,
                    severity=ValidationSeverity.ERROR,
                    message=f"Accessibility validation failed: {str(e)}",
                    rule_id="A11Y001",
                )
            )
            score = 0.0

        return self.issues, score

    def _check_images(self, soup: "BeautifulSoup"):
        """Check image accessibility"""
        images = soup.find_all("img")
        for img in images:
            if not img.get("alt"):
                self.issues.append(
                    ValidationIssue(
                        type=ValidationType.ACCESSIBILITY,
                        severity=ValidationSeverity.ERROR,
                        message="Image missing alt attribute",
                        element="img",
                        suggestion="Add descriptive alt text for screen readers",
                        rule_id="A11Y002",
                    )
                )
            elif img.get("alt") == "":
                # Empty alt is okay for decorative images, but check if it's intentional
                self.issues.append(
                    ValidationIssue(
                        type=ValidationType.ACCESSIBILITY,
                        severity=ValidationSeverity.INFO,
                        message="Image has empty alt attribute",
                        element="img",
                        suggestion="Ensure empty alt is intentional for decorative images",
                        rule_id="A11Y003",
                    )
                )

    def _check_forms(self, soup: "BeautifulSoup"):
        """Check form accessibility"""
        # Check for form labels
        inputs = soup.find_all(["input", "select", "textarea"])
        for input_elem in inputs:
            input_type = input_elem.get("type", "text")
            if input_type not in ["hidden", "submit", "button"]:
                input_id = input_elem.get("id")

                # Check for associated label
                if input_id:
                    label = soup.find("label", attrs={"for": input_id})
                    if not label:
                        self.issues.append(
                            ValidationIssue(
                                type=ValidationType.ACCESSIBILITY,
                                severity=ValidationSeverity.ERROR,
                                message="Form input missing associated label",
                                element=input_elem.name,
                                suggestion="Add a label with 'for' attribute matching input id",
                                rule_id="A11Y004",
                            )
                        )
                else:
                    self.issues.append(
                        ValidationIssue(
                            type=ValidationType.ACCESSIBILITY,
                            severity=ValidationSeverity.WARNING,
                            message="Form input missing id attribute",
                            element=input_elem.name,
                            suggestion="Add id attribute to associate with label",
                            rule_id="A11Y005",
                        )
                    )

    def _check_headings(self, soup: "BeautifulSoup"):
        """Check heading hierarchy"""
        headings = soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])

        if not headings:
            self.issues.append(
                ValidationIssue(
                    type=ValidationType.ACCESSIBILITY,
                    severity=ValidationSeverity.WARNING,
                    message="No heading elements found",
                    suggestion="Use heading elements (h1-h6) to structure content",
                    rule_id="A11Y006",
                )
            )
            return

        # Check for h1
        h1_elements = soup.find_all("h1")
        if len(h1_elements) == 0:
            self.issues.append(
                ValidationIssue(
                    type=ValidationType.ACCESSIBILITY,
                    severity=ValidationSeverity.WARNING,
                    message="No h1 element found",
                    suggestion="Include one h1 element for main page heading",
                    rule_id="A11Y007",
                )
            )
        elif len(h1_elements) > 1:
            self.issues.append(
                ValidationIssue(
                    type=ValidationType.ACCESSIBILITY,
                    severity=ValidationSeverity.WARNING,
                    message="Multiple h1 elements found",
                    suggestion="Use only one h1 element per page",
                    rule_id="A11Y008",
                )
            )

    def _check_links(self, soup: "BeautifulSoup"):
        """Check link accessibility"""
        links = soup.find_all("a")
        for link in links:
            href = link.get("href")
            text = link.get_text(strip=True)

            if not text and not link.get("aria-label") and not link.get("title"):
                self.issues.append(
                    ValidationIssue(
                        type=ValidationType.ACCESSIBILITY,
                        severity=ValidationSeverity.ERROR,
                        message="Link missing descriptive text",
                        element="a",
                        suggestion="Add descriptive text, aria-label, or title attribute",
                        rule_id="A11Y009",
                    )
                )

            # Check for generic link text
            generic_texts = ["click here", "read more", "more", "here", "link"]
            if text.lower() in generic_texts:
                self.issues.append(
                    ValidationIssue(
                        type=ValidationType.ACCESSIBILITY,
                        severity=ValidationSeverity.WARNING,
                        message="Link uses generic text",
                        element="a",
                        context=f"Text: '{text}'",
                        suggestion="Use descriptive link text that explains the destination",
                        rule_id="A11Y010",
                    )
                )

    def _check_landmarks(self, soup: "BeautifulSoup"):
        """Check for ARIA landmarks and semantic structure"""
        landmarks = soup.find_all(
            ["main", "nav", "header", "footer", "aside", "section"]
        )

        if not landmarks:
            self.issues.append(
                ValidationIssue(
                    type=ValidationType.ACCESSIBILITY,
                    severity=ValidationSeverity.INFO,
                    message="No landmark elements found",
                    suggestion="Use semantic HTML5 elements (main, nav, header, footer) for better navigation",
                    rule_id="A11Y011",
                )
            )

        # Check for main landmark
        main_elements = soup.find_all("main")
        if len(main_elements) == 0:
            self.issues.append(
                ValidationIssue(
                    type=ValidationType.ACCESSIBILITY,
                    severity=ValidationSeverity.INFO,
                    message="No main landmark found",
                    suggestion="Use <main> element to identify primary content",
                    rule_id="A11Y012",
                )
            )

    def _check_colors_and_contrast(self, html_content: str):
        """Basic color and contrast checks"""
        # Check for color-only information (basic regex check)
        color_only_patterns = [
            r"color\s*:\s*red",
            r"color\s*:\s*green",
            r"background-color\s*:\s*red",
            r"background-color\s*:\s*green",
        ]

        for pattern in color_only_patterns:
            if re.search(pattern, html_content, re.IGNORECASE):
                self.issues.append(
                    ValidationIssue(
                        type=ValidationType.ACCESSIBILITY,
                        severity=ValidationSeverity.WARNING,
                        message="Potential color-only information detected",
                        suggestion="Ensure information is not conveyed by color alone",
                        rule_id="A11Y013",
                    )
                )
                break

    def _calculate_accessibility_score(self) -> float:
        """Calculate accessibility score (0-100)"""
        if not self.issues:
            return 100.0

        # Deduct points based on issue severity
        total_deductions = 0
        for issue in self.issues:
            if issue.severity == ValidationSeverity.CRITICAL:
                total_deductions += 25
            elif issue.severity == ValidationSeverity.ERROR:
                total_deductions += 15
            elif issue.severity == ValidationSeverity.WARNING:
                total_deductions += 5
            elif issue.severity == ValidationSeverity.INFO:
                total_deductions += 1

        score = max(0, 100 - total_deductions)
        return score


class ComprehensiveTemplateValidator:
    """Main template validation orchestrator"""

    def __init__(self):
        self.html_validator = HTMLValidator()
        self.security_scanner = SecurityScanner()
        self.performance_analyzer = PerformanceAnalyzer()
        self.accessibility_validator = AccessibilityValidator()
        self.css_validator = CSSValidator(strict_mode=True)
        self.slot_validator = SlotValidator()

    def validate_template(
        self,
        html_content: str,
        css_content: str = "",
        template_file: str = None,
        validation_options: Dict[str, bool] = None,
    ) -> ValidationResult:
        """
        Perform comprehensive template validation

        Args:
            html_content: HTML template content
            css_content: CSS content (from style tags or external)
            template_file: Template file path for context
            validation_options: Dict of validation types to enable/disable

        Returns:
            ValidationResult with all validation findings
        """
        start_time = time.time()

        # Default validation options
        default_options = {
            "html_validation": True,
            "css_validation": True,
            "security_scan": True,
            "performance_analysis": True,
            "accessibility_check": True,
            "slot_validation": True,
        }

        options = {**default_options, **(validation_options or {})}

        result = ValidationResult(is_valid=True)
        all_issues = []

        try:
            # HTML validation
            if options["html_validation"]:
                html_issues = self.html_validator.validate(html_content)
                all_issues.extend(html_issues)

            # CSS validation
            if options["css_validation"] and css_content:
                css_is_valid, css_errors, css_warnings = (
                    self.css_validator.validate_css(
                        css_content, template_file or "template"
                    )
                )

                for error in css_errors:
                    all_issues.append(
                        ValidationIssue(
                            type=ValidationType.CSS_SYNTAX,
                            severity=ValidationSeverity.ERROR,
                            message=error,
                            rule_id="CSS001",
                        )
                    )

                for warning in css_warnings:
                    all_issues.append(
                        ValidationIssue(
                            type=ValidationType.CSS_SYNTAX,
                            severity=ValidationSeverity.WARNING,
                            message=warning,
                            rule_id="CSS002",
                        )
                    )

            # Security scanning
            if options["security_scan"]:
                security_issues = self.security_scanner.scan(html_content, css_content)
                all_issues.extend(security_issues)

            # Performance analysis
            if options["performance_analysis"]:
                result.performance_metrics = self.performance_analyzer.analyze(
                    html_content, css_content
                )

            # Accessibility validation
            if options["accessibility_check"]:
                a11y_issues, a11y_score = self.accessibility_validator.validate(
                    html_content
                )
                all_issues.extend(a11y_issues)
                result.accessibility_score = a11y_score

            # Slot validation
            if options["slot_validation"]:
                slot_issues = self._validate_slots(html_content, template_file)
                all_issues.extend(slot_issues)

            # Calculate scores
            result.security_score = self._calculate_security_score(all_issues)
            result.seo_score = self._calculate_seo_score(all_issues)

            # Determine overall validity
            result.is_valid = not any(
                issue.severity
                in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL]
                for issue in all_issues
            )

            result.issues = all_issues

        except Exception as e:
            logger.error(f"Template validation failed: {e}")
            result.is_valid = False
            result.issues = [
                ValidationIssue(
                    type=ValidationType.HTML_SYNTAX,
                    severity=ValidationSeverity.CRITICAL,
                    message=f"Validation failed: {str(e)}",
                    rule_id="VAL001",
                )
            ]

        result.validation_time_ms = (time.time() - start_time) * 1000
        return result

    def _validate_slots(
        self, html_content: str, template_file: str = None
    ) -> List[ValidationIssue]:
        """Validate widget slots in template"""
        issues = []

        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(html_content, "html.parser")

            # Find all slot elements
            slot_elements = soup.find_all(attrs={"data-widget-slot": True})

            if not slot_elements:
                issues.append(
                    ValidationIssue(
                        type=ValidationType.SLOT_CONFIGURATION,
                        severity=ValidationSeverity.INFO,
                        message="No widget slots found in template",
                        suggestion="Add data-widget-slot attributes to enable widget placement",
                        rule_id="SLOT001",
                    )
                )
                return issues

            slot_names = []
            for slot_elem in slot_elements:
                slot_name = slot_elem.get("data-widget-slot")

                # Validate slot name
                try:
                    self.slot_validator.validate_slot_name(slot_name, template_file)
                    slot_names.append(slot_name)
                except TemplateParsingError as e:
                    issues.append(
                        ValidationIssue(
                            type=ValidationType.SLOT_CONFIGURATION,
                            severity=ValidationSeverity.ERROR,
                            message=str(e),
                            element="data-widget-slot",
                            rule_id="SLOT002",
                        )
                    )

            # Check for duplicate slot names
            duplicates = set(
                [name for name in slot_names if slot_names.count(name) > 1]
            )
            if duplicates:
                issues.append(
                    ValidationIssue(
                        type=ValidationType.SLOT_CONFIGURATION,
                        severity=ValidationSeverity.WARNING,
                        message=f"Duplicate slot names found: {', '.join(duplicates)}",
                        suggestion="Use unique slot names or enable duplicate slots if intentional",
                        rule_id="SLOT003",
                    )
                )

        except Exception as e:
            issues.append(
                ValidationIssue(
                    type=ValidationType.SLOT_CONFIGURATION,
                    severity=ValidationSeverity.ERROR,
                    message=f"Slot validation failed: {str(e)}",
                    rule_id="SLOT004",
                )
            )

        return issues

    def _calculate_security_score(self, issues: List[ValidationIssue]) -> float:
        """Calculate security score based on security issues"""
        security_issues = [i for i in issues if i.type == ValidationType.SECURITY_SCAN]

        if not security_issues:
            return 100.0

        total_deductions = 0
        for issue in security_issues:
            if issue.severity == ValidationSeverity.CRITICAL:
                total_deductions += 30
            elif issue.severity == ValidationSeverity.ERROR:
                total_deductions += 20
            elif issue.severity == ValidationSeverity.WARNING:
                total_deductions += 10

        return max(0, 100 - total_deductions)

    def _calculate_seo_score(self, issues: List[ValidationIssue]) -> float:
        """Calculate basic SEO score"""
        seo_relevant_issues = [
            i
            for i in issues
            if i.type in [ValidationType.HTML_STRUCTURE, ValidationType.ACCESSIBILITY]
            and i.rule_id in ["HTML005", "HTML006", "A11Y006", "A11Y007"]
        ]

        base_score = 80.0  # Base SEO score

        for issue in seo_relevant_issues:
            if issue.severity == ValidationSeverity.ERROR:
                base_score -= 15
            elif issue.severity == ValidationSeverity.WARNING:
                base_score -= 10
            elif issue.severity == ValidationSeverity.INFO:
                base_score -= 5

        return max(0, base_score)


# Global validator instance
template_validator = ComprehensiveTemplateValidator()
