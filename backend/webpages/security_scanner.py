"""
Advanced Security Scanner for Template Validation

This module provides specialized security scanning capabilities for HTML templates,
focusing on XSS prevention, injection attack detection, and content security policy validation.
"""

import re
import json
import logging
from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass
from enum import Enum
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class SecurityThreatLevel(Enum):
    """Security threat severity levels"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class SecurityFinding:
    """Individual security finding"""

    threat_level: SecurityThreatLevel
    category: str
    description: str
    context: Optional[str] = None
    line_number: Optional[int] = None
    column_number: Optional[int] = None
    mitigation: Optional[str] = None
    cwe_id: Optional[str] = None  # Common Weakness Enumeration ID

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "threat_level": self.threat_level.value,
            "category": self.category,
            "description": self.description,
            "context": self.context,
            "line_number": self.line_number,
            "column_number": self.column_number,
            "mitigation": self.mitigation,
            "cwe_id": self.cwe_id,
        }


class XSSScanner:
    """Cross-Site Scripting (XSS) vulnerability scanner"""

    def __init__(self):
        # Dangerous HTML elements that can execute JavaScript
        self.dangerous_elements = {
            "script",
            "iframe",
            "object",
            "embed",
            "applet",
            "form",
            "input",
            "button",
            "select",
            "textarea",
            "meta",
        }

        # Event handler attributes
        self.event_handlers = {
            "onload",
            "onclick",
            "ondblclick",
            "onmousedown",
            "onmouseup",
            "onmouseover",
            "onmousemove",
            "onmouseout",
            "onfocus",
            "onblur",
            "onkeypress",
            "onkeydown",
            "onkeyup",
            "onsubmit",
            "onreset",
            "onselect",
            "onchange",
            "onerror",
            "onabort",
            "onunload",
            "onresize",
            "onscroll",
            "oncontextmenu",
            "ondrag",
            "ondrop",
            "onwheel",
            "oncopy",
            "oncut",
            "onpaste",
            "oninput",
            "oninvalid",
        }

        # Dangerous URL schemes
        self.dangerous_schemes = {
            "javascript:",
            "vbscript:",
            "data:",
            "file:",
            "about:",
            "chrome:",
            "chrome-extension:",
            "moz-extension:",
        }

        # Dangerous CSS properties and functions
        self.dangerous_css_patterns = [
            r"expression\s*\(",  # IE expression() function
            r"javascript\s*:",  # JavaScript URLs in CSS
            r"vbscript\s*:",  # VBScript URLs
            r'@import\s+["\']javascript:',  # JavaScript in @import
            r"-moz-binding\s*:",  # Firefox XBL binding
            r"behavior\s*:",  # IE behavior property
            r'url\s*\(\s*["\']?javascript:',  # JavaScript in url()
        ]

    def scan_html(self, html_content: str) -> List[SecurityFinding]:
        """Scan HTML content for XSS vulnerabilities"""
        findings = []

        if not html_content:
            return findings

        # Check for script tags
        findings.extend(self._check_script_tags(html_content))

        # Check for event handlers
        findings.extend(self._check_event_handlers(html_content))

        # Check for dangerous elements
        findings.extend(self._check_dangerous_elements(html_content))

        # Check for data URIs
        findings.extend(self._check_data_uris(html_content))

        # Check for HTML entity encoding bypasses
        findings.extend(self._check_encoding_bypasses(html_content))

        # Check for template injection patterns
        findings.extend(self._check_template_injection(html_content))

        return findings

    def _check_script_tags(self, html_content: str) -> List[SecurityFinding]:
        """Check for script tags"""
        findings = []

        # Case-insensitive script tag detection
        script_pattern = r"<\s*script[^>]*>.*?</\s*script\s*>"
        matches = re.finditer(script_pattern, html_content, re.IGNORECASE | re.DOTALL)

        for match in matches:
            findings.append(
                SecurityFinding(
                    threat_level=SecurityThreatLevel.CRITICAL,
                    category="XSS",
                    description="Script tag detected in template",
                    context=(
                        match.group(0)[:100] + "..."
                        if len(match.group(0)) > 100
                        else match.group(0)
                    ),
                    line_number=html_content[: match.start()].count("\n") + 1,
                    mitigation="Remove script tags and use external JavaScript files with proper CSP",
                    cwe_id="CWE-79",
                )
            )

        # Check for self-closing script tags
        self_closing_pattern = r"<\s*script[^>]*/?>"
        matches = re.finditer(self_closing_pattern, html_content, re.IGNORECASE)

        for match in matches:
            findings.append(
                SecurityFinding(
                    threat_level=SecurityThreatLevel.HIGH,
                    category="XSS",
                    description="Self-closing script tag detected",
                    context=match.group(0),
                    line_number=html_content[: match.start()].count("\n") + 1,
                    mitigation="Remove script tags completely",
                    cwe_id="CWE-79",
                )
            )

        return findings

    def _check_event_handlers(self, html_content: str) -> List[SecurityFinding]:
        """Check for inline event handlers"""
        findings = []

        for handler in self.event_handlers:
            pattern = rf'{handler}\s*=\s*["\'][^"\']*["\']'
            matches = re.finditer(pattern, html_content, re.IGNORECASE)

            for match in matches:
                findings.append(
                    SecurityFinding(
                        threat_level=SecurityThreatLevel.HIGH,
                        category="XSS",
                        description=f"Inline event handler detected: {handler}",
                        context=match.group(0),
                        line_number=html_content[: match.start()].count("\n") + 1,
                        mitigation="Use external event listeners instead of inline handlers",
                        cwe_id="CWE-79",
                    )
                )

        return findings

    def _check_dangerous_elements(self, html_content: str) -> List[SecurityFinding]:
        """Check for potentially dangerous HTML elements"""
        findings = []

        # Check for iframe elements
        iframe_pattern = r"<\s*iframe[^>]*>"
        matches = re.finditer(iframe_pattern, html_content, re.IGNORECASE)

        for match in matches:
            # Check if iframe has sandbox attribute
            if "sandbox=" not in match.group(0).lower():
                findings.append(
                    SecurityFinding(
                        threat_level=SecurityThreatLevel.MEDIUM,
                        category="Content Injection",
                        description="Iframe without sandbox attribute",
                        context=match.group(0),
                        line_number=html_content[: match.start()].count("\n") + 1,
                        mitigation="Add sandbox attribute to iframe or remove if not necessary",
                        cwe_id="CWE-79",
                    )
                )

        # Check for object and embed elements
        for element in ["object", "embed", "applet"]:
            pattern = rf"<\s*{element}[^>]*>"
            matches = re.finditer(pattern, html_content, re.IGNORECASE)

            for match in matches:
                findings.append(
                    SecurityFinding(
                        threat_level=SecurityThreatLevel.HIGH,
                        category="Content Injection",
                        description=f"Potentially dangerous element: {element}",
                        context=match.group(0),
                        line_number=html_content[: match.start()].count("\n") + 1,
                        mitigation=f"Remove {element} element or ensure content source is trusted",
                        cwe_id="CWE-79",
                    )
                )

        return findings

    def _check_data_uris(self, html_content: str) -> List[SecurityFinding]:
        """Check for potentially dangerous data URIs"""
        findings = []

        # Look for data URIs
        data_uri_pattern = r'data:([^;,]+)([^,]*),([^"\'\s>]*)'
        matches = re.finditer(data_uri_pattern, html_content, re.IGNORECASE)

        for match in matches:
            mime_type = match.group(1).lower()
            data_content = match.group(3)

            # Check for dangerous MIME types
            if mime_type in ["text/html", "application/javascript", "text/javascript"]:
                findings.append(
                    SecurityFinding(
                        threat_level=SecurityThreatLevel.CRITICAL,
                        category="XSS",
                        description=f"Dangerous data URI with MIME type: {mime_type}",
                        context=(
                            match.group(0)[:100] + "..."
                            if len(match.group(0)) > 100
                            else match.group(0)
                        ),
                        line_number=html_content[: match.start()].count("\n") + 1,
                        mitigation="Use external files instead of data URIs for executable content",
                        cwe_id="CWE-79",
                    )
                )

            # Check for base64 encoded script content
            if "base64" in match.group(2) and any(
                keyword in data_content.lower()
                for keyword in ["script", "javascript", "eval", "function"]
            ):
                findings.append(
                    SecurityFinding(
                        threat_level=SecurityThreatLevel.HIGH,
                        category="XSS",
                        description="Potentially dangerous base64 data URI content",
                        context=(
                            match.group(0)[:100] + "..."
                            if len(match.group(0)) > 100
                            else match.group(0)
                        ),
                        line_number=html_content[: match.start()].count("\n") + 1,
                        mitigation="Review base64 content for malicious code",
                        cwe_id="CWE-79",
                    )
                )

        return findings

    def _check_encoding_bypasses(self, html_content: str) -> List[SecurityFinding]:
        """Check for HTML entity encoding bypasses"""
        findings = []

        # Check for hexadecimal and decimal HTML entities that might encode dangerous content
        suspicious_entities = [
            r"&#x6A;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;",  # javascript
            r"&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;",  # javascript
            r"&#x76;&#x62;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;",  # vbscript
            r"&#118;&#98;&#115;&#99;&#114;&#105;&#112;&#116;",  # vbscript
        ]

        for pattern in suspicious_entities:
            matches = re.finditer(pattern, html_content, re.IGNORECASE)
            for match in matches:
                findings.append(
                    SecurityFinding(
                        threat_level=SecurityThreatLevel.HIGH,
                        category="XSS",
                        description="HTML entity encoding of dangerous content detected",
                        context=match.group(0),
                        line_number=html_content[: match.start()].count("\n") + 1,
                        mitigation="Remove encoded dangerous content",
                        cwe_id="CWE-79",
                    )
                )

        return findings

    def _check_template_injection(self, html_content: str) -> List[SecurityFinding]:
        """Check for template injection patterns"""
        findings = []

        # Common template injection patterns
        template_patterns = [
            r"\{\{.*eval.*\}\}",  # Django/Jinja2 eval
            r"\{\{.*import.*\}\}",  # Django/Jinja2 import
            r"\{\{.*__.*__.*\}\}",  # Python dunder methods
            r"\{\%.*load.*\%\}.*\{\%.*ssi.*\%\}",  # Django SSI inclusion
        ]

        for pattern in template_patterns:
            matches = re.finditer(pattern, html_content, re.IGNORECASE)
            for match in matches:
                findings.append(
                    SecurityFinding(
                        threat_level=SecurityThreatLevel.HIGH,
                        category="Template Injection",
                        description="Potentially dangerous template syntax detected",
                        context=match.group(0),
                        line_number=html_content[: match.start()].count("\n") + 1,
                        mitigation="Review template syntax for security implications",
                        cwe_id="CWE-94",
                    )
                )

        return findings

    def scan_css(self, css_content: str) -> List[SecurityFinding]:
        """Scan CSS content for XSS vulnerabilities"""
        findings = []

        if not css_content:
            return findings

        for pattern in self.dangerous_css_patterns:
            matches = re.finditer(pattern, css_content, re.IGNORECASE)
            for match in matches:
                findings.append(
                    SecurityFinding(
                        threat_level=SecurityThreatLevel.HIGH,
                        category="CSS Injection",
                        description="Dangerous CSS pattern detected",
                        context=match.group(0),
                        line_number=css_content[: match.start()].count("\n") + 1,
                        mitigation="Remove dangerous CSS properties and functions",
                        cwe_id="CWE-79",
                    )
                )

        return findings


class SQLInjectionScanner:
    """SQL Injection vulnerability scanner for template content"""

    def __init__(self):
        # SQL injection patterns
        self.sql_patterns = [
            r"union\s+select",
            r"insert\s+into",
            r"delete\s+from",
            r"update\s+.*set",
            r"drop\s+table",
            r"create\s+table",
            r"alter\s+table",
            r"exec\s*\(",
            r"sp_executesql",
            r"xp_cmdshell",
            r"--\s*$",  # SQL comments
            r"/\*.*\*/",  # SQL block comments
        ]

    def scan(self, content: str) -> List[SecurityFinding]:
        """Scan content for SQL injection patterns"""
        findings = []

        if not content:
            return findings

        for pattern in self.sql_patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE)
            for match in matches:
                findings.append(
                    SecurityFinding(
                        threat_level=SecurityThreatLevel.HIGH,
                        category="SQL Injection",
                        description="Potential SQL injection pattern detected",
                        context=match.group(0),
                        line_number=content[: match.start()].count("\n") + 1,
                        mitigation="Use parameterized queries and validate all input",
                        cwe_id="CWE-89",
                    )
                )

        return findings


class ContentSecurityPolicyValidator:
    """Content Security Policy validation"""

    def __init__(self):
        self.unsafe_keywords = ["unsafe-inline", "unsafe-eval", "unsafe-hashes"]
        self.dangerous_sources = ["*", "data:", "blob:"]

    def validate_csp_compatibility(
        self, html_content: str, css_content: str
    ) -> List[SecurityFinding]:
        """Validate template content for CSP compatibility"""
        findings = []

        # Check for inline styles
        inline_style_pattern = r'style\s*=\s*["\'][^"\']*["\']'
        matches = re.finditer(inline_style_pattern, html_content, re.IGNORECASE)

        for match in matches:
            findings.append(
                SecurityFinding(
                    threat_level=SecurityThreatLevel.MEDIUM,
                    category="CSP Violation",
                    description="Inline style detected (violates strict CSP)",
                    context=match.group(0),
                    line_number=html_content[: match.start()].count("\n") + 1,
                    mitigation="Move styles to external CSS files or use nonce/hash",
                    cwe_id="CWE-79",
                )
            )

        # Check for style tags
        style_tag_pattern = r"<style[^>]*>.*?</style>"
        matches = re.finditer(
            style_tag_pattern, html_content, re.IGNORECASE | re.DOTALL
        )

        for match in matches:
            findings.append(
                SecurityFinding(
                    threat_level=SecurityThreatLevel.MEDIUM,
                    category="CSP Violation",
                    description="Style tag detected (violates strict CSP)",
                    context=(
                        match.group(0)[:100] + "..."
                        if len(match.group(0)) > 100
                        else match.group(0)
                    ),
                    line_number=html_content[: match.start()].count("\n") + 1,
                    mitigation="Move styles to external CSS files or use nonce/hash",
                    cwe_id="CWE-79",
                )
            )

        return findings


class AdvancedSecurityScanner:
    """Advanced security scanner combining multiple scanning techniques"""

    def __init__(self):
        self.xss_scanner = XSSScanner()
        self.sql_scanner = SQLInjectionScanner()
        self.csp_validator = ContentSecurityPolicyValidator()

    def comprehensive_scan(
        self,
        html_content: str,
        css_content: str = "",
        scan_options: Dict[str, bool] = None,
    ) -> Tuple[List[SecurityFinding], Dict[str, Any]]:
        """
        Perform comprehensive security scan

        Returns:
            Tuple of (findings, security_metrics)
        """
        default_options = {
            "xss_scan": True,
            "sql_injection_scan": True,
            "csp_validation": True,
        }

        options = {**default_options, **(scan_options or {})}

        all_findings = []

        # XSS scanning
        if options["xss_scan"]:
            all_findings.extend(self.xss_scanner.scan_html(html_content))
            all_findings.extend(self.xss_scanner.scan_css(css_content))

        # SQL injection scanning
        if options["sql_injection_scan"]:
            all_findings.extend(self.sql_scanner.scan(html_content))
            all_findings.extend(self.sql_scanner.scan(css_content))

        # CSP validation
        if options["csp_validation"]:
            all_findings.extend(
                self.csp_validator.validate_csp_compatibility(html_content, css_content)
            )

        # Calculate security metrics
        security_metrics = self._calculate_security_metrics(all_findings)

        return all_findings, security_metrics

    def _calculate_security_metrics(
        self, findings: List[SecurityFinding]
    ) -> Dict[str, Any]:
        """Calculate security metrics from findings"""
        total_findings = len(findings)

        severity_counts = {
            "critical": len(
                [f for f in findings if f.threat_level == SecurityThreatLevel.CRITICAL]
            ),
            "high": len(
                [f for f in findings if f.threat_level == SecurityThreatLevel.HIGH]
            ),
            "medium": len(
                [f for f in findings if f.threat_level == SecurityThreatLevel.MEDIUM]
            ),
            "low": len(
                [f for f in findings if f.threat_level == SecurityThreatLevel.LOW]
            ),
        }

        category_counts = {}
        for finding in findings:
            category_counts[finding.category] = (
                category_counts.get(finding.category, 0) + 1
            )

        # Calculate security score (0-100)
        security_score = 100
        if total_findings > 0:
            # Deduct points based on severity
            security_score -= severity_counts["critical"] * 25
            security_score -= severity_counts["high"] * 15
            security_score -= severity_counts["medium"] * 10
            security_score -= severity_counts["low"] * 5
            security_score = max(0, security_score)

        return {
            "total_findings": total_findings,
            "severity_counts": severity_counts,
            "category_counts": category_counts,
            "security_score": security_score,
            "risk_level": self._determine_risk_level(severity_counts),
        }

    def _determine_risk_level(self, severity_counts: Dict[str, int]) -> str:
        """Determine overall risk level"""
        if severity_counts["critical"] > 0:
            return "CRITICAL"
        elif severity_counts["high"] > 0:
            return "HIGH"
        elif severity_counts["medium"] > 0:
            return "MEDIUM"
        elif severity_counts["low"] > 0:
            return "LOW"
        else:
            return "MINIMAL"


# Global scanner instance
security_scanner = AdvancedSecurityScanner()
