"""Compile site CSS for safe use inside the direct-DOM page editor."""

import re

import tinycss2

EDITOR_THEME_SCOPE = ".eceee-theme-scope"
EDITOR_UI_LIMIT = ".eceee-editor-ui"

_DOCUMENT_ROOT_PATTERN = re.compile(r"(?<![-\w])(?:html|body)(?![-\w])|:root", re.IGNORECASE)
_REPEATED_SCOPE_PATTERN = re.compile(r":scope\s+(?:>\s*)?:scope")
_GLOBAL_AT_RULES = {
    "charset",
    "counter-style",
    "font-face",
    "font-feature-values",
    "font-palette-values",
    "keyframes",
    "namespace",
    "page",
    "property",
}
_GROUPING_AT_RULES = {
    "container",
    "document",
    "layer",
    "media",
    "scope",
    "starting-style",
    "supports",
}


def _rewrite_document_roots(selector):
    """Make document-root selectors refer to the editor's scope root."""
    selector = _DOCUMENT_ROOT_PATTERN.sub(":scope", selector)
    while _REPEATED_SCOPE_PATTERN.search(selector):
        selector = _REPEATED_SCOPE_PATTERN.sub(":scope", selector)
    return selector


def _serialize_rule(rule):
    if rule.type == "qualified-rule":
        selector = _rewrite_document_roots(tinycss2.serialize(rule.prelude).strip())
        return f"{selector} {{{tinycss2.serialize(rule.content)}}}"

    if rule.type == "at-rule":
        keyword = rule.lower_at_keyword
        prelude = tinycss2.serialize(rule.prelude).strip()
        header = f"@{rule.at_keyword}{f' {prelude}' if prelude else ''}"
        if rule.content is None:
            return f"{header};"
        if keyword in _GROUPING_AT_RULES:
            nested_rules = tinycss2.parse_rule_list(rule.content, skip_whitespace=True, skip_comments=False)
            nested = "\n".join(_serialize_rule(nested_rule) for nested_rule in nested_rules)
            return f"{header} {{\n{nested}\n}}"
        return f"{header} {{{tinycss2.serialize(rule.content)}}}"

    return tinycss2.serialize([rule])


def compile_editor_css(css, root_selector=EDITOR_THEME_SCOPE, limit_selector=EDITOR_UI_LIMIT):
    """Wrap a complete site stylesheet in a native CSS scope for the editor.

    Google Fonts imports and name-defining at-rules must remain top-level by CSS
    grammar. Other imports are omitted because their rules would escape the scope.
    All style rules are placed in a scope with a lower boundary around editor
    chrome. Document-root selectors are rewritten to target the scope root.
    """
    if not css or not css.strip():
        return ""

    rules = tinycss2.parse_stylesheet(css, skip_whitespace=True, skip_comments=False)
    top_level = []
    scoped = []

    for rule in rules:
        if rule.type == "at-rule" and rule.lower_at_keyword == "import":
            import_target = tinycss2.serialize(rule.prelude).lower()
            if "fonts.googleapis.com" in import_target:
                top_level.append(_serialize_rule(rule))
            else:
                scoped.append("/* @import omitted: external stylesheets cannot be safely scoped in the editor. */")
            continue
        if rule.type == "at-rule" and (
            rule.lower_at_keyword in _GLOBAL_AT_RULES or rule.lower_at_keyword.endswith("keyframes")
        ):
            top_level.append(_serialize_rule(rule))
        else:
            scoped.append(_serialize_rule(rule))

    parts = top_level
    if scoped:
        parts.append(f"@scope ({root_selector}) to ({limit_selector}) {{\n" + "\n".join(scoped) + "\n}")
    return "\n\n".join(part for part in parts if part.strip())
