"""Theme-local widget definitions. Released schemas and presentation are immutable."""

import copy
import json
import re
from html.parser import HTMLParser
from uuid import UUID

import bleach
import jsonschema
import tinycss2
from django.core.exceptions import ValidationError

PREFIX = "theme_widgets."
FIELD_NAME = re.compile(r"^[a-z][a-zA-Z0-9]{0,63}$")
FORMATS = {"textarea", "rich-text", "uri", "media"}
TAGS = set(bleach.sanitizer.ALLOWED_TAGS) | {
    "div",
    "span",
    "p",
    "article",
    "section",
    "header",
    "footer",
    "aside",
    "figure",
    "figcaption",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "img",
    "br",
    "hr",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
}
ATTRS = {"class", "id", "title", "alt", "src", "href", "target", "rel", "loading", "width", "height", "role"}


def empty_widget_types():
    return {"version": 1, "items": []}


def is_theme_widget(widget_type):
    return isinstance(widget_type, str) and widget_type.startswith(PREFIX)


def clean_html(html):
    return bleach.clean(
        str(html),
        tags=TAGS,
        attributes=lambda tag, name, value: name in ATTRS or name.startswith("aria-"),
        protocols={"http", "https", "mailto", "tel"},
        strip=True,
    )


class TemplateValidator(HTMLParser):
    def handle_starttag(self, tag, attrs):
        if tag not in TAGS:
            raise ValidationError(f"Unsupported template element: {tag}.")
        for name, value in attrs:
            if name not in ATTRS and not name.startswith("aria-"):
                raise ValidationError(f"Unsupported template attribute: {name}.")
            if name in {"href", "src"} and value and not value.startswith("{{"):
                if re.match(r"\s*(?:javascript|data|vbscript):", value, re.I):
                    raise ValidationError("Unsafe template URL.")

    handle_startendtag = handle_starttag


def compile_css(css, type_id, version):
    """Parse rules/declarations before adding a release-specific scope to every selector."""
    if not isinstance(css, str) or len(css) > 50000 or "<" in css or "\\" in css:
        raise ValidationError("Invalid widget CSS.")
    scope = f'[data-theme-widget="{type_id}:{version}"]'

    def safe_tokens(tokens):
        for token in tokens:
            if token.type in {"error", "url", "at-keyword"}:
                raise ValidationError("CSS resources and invalid values are not supported.")
            if token.type == "function":
                if token.lower_name in {"url", "expression", "image-set", "-webkit-image-set"}:
                    raise ValidationError("CSS external resources are not supported.")
                safe_tokens(token.arguments)
            elif hasattr(token, "content"):
                safe_tokens(token.content)

    def rules(nodes):
        output = []
        for node in nodes:
            if node.type == "qualified-rule":
                safe_tokens(node.prelude)
                groups, current = [], []
                for token in node.prelude:
                    if token.type == "literal" and token.value == ",":
                        groups.append(current)
                        current = []
                    else:
                        current.append(token)
                groups.append(current)
                selectors = []
                for group in groups:
                    meaningful = [token for token in group if token.type not in {"whitespace", "comment"}]
                    if meaningful and meaningful[0].type == "literal" and meaningful[0].value in {"+", "~"}:
                        raise ValidationError("CSS selectors cannot target widget siblings.")
                    selector = tinycss2.serialize(group).strip()
                    if not selector or re.search(r":(?:root|host|global)|[{}@]", selector, re.I):
                        raise ValidationError("Unsupported CSS selector.")
                    selectors.append(f"{scope} {selector}")
                declarations = tinycss2.parse_declaration_list(node.content, skip_comments=True, skip_whitespace=True)
                for declaration in declarations:
                    if declaration.type != "declaration" or declaration.lower_name in {"behavior", "-moz-binding"}:
                        raise ValidationError("Unsupported CSS declaration.")
                    safe_tokens(declaration.value)
                output.append(",".join(selectors) + "{" + tinycss2.serialize(declarations) + "}")
            elif node.type == "at-rule" and node.lower_at_keyword == "media" and node.content is not None:
                safe_tokens(node.prelude)
                output.append(
                    "@media "
                    + tinycss2.serialize(node.prelude)
                    + "{"
                    + rules(tinycss2.parse_rule_list(node.content, skip_comments=True, skip_whitespace=True))
                    + "}"
                )
            else:
                raise ValidationError("Only scoped CSS rules and media queries are supported.")
        return "".join(output)

    return rules(tinycss2.parse_stylesheet(css, skip_comments=True, skip_whitespace=True))


def validate_schema(schema):
    if not isinstance(schema, dict) or schema.get("type") != "object":
        raise ValidationError("Widget schema must describe an object.")
    if set(schema) - {"type", "properties", "required", "propertyOrder", "additionalProperties"}:
        raise ValidationError("Unsupported widget schema options.")
    if not isinstance(schema.get("additionalProperties", True), bool):
        raise ValidationError("additionalProperties must be a boolean.")
    if not isinstance(schema.get("required", []), list) or any(
        not isinstance(name, str) for name in schema.get("required", [])
    ):
        raise ValidationError("Required fields must be an array of names.")
    properties = schema.get("properties", {})
    if not isinstance(properties, dict) or len(properties) > 64:
        raise ValidationError("Widget schema supports at most 64 fields.")
    for name, field in properties.items():
        if (
            not FIELD_NAME.fullmatch(name)
            or re.search(r"[A-Z]{2,}", name)
            or name in {"constructor", "prototype", "__proto__", "slots"}
        ):
            raise ValidationError(f"Invalid widget field name: {name}.")
        if not isinstance(field, dict) or field.get("type") not in [
            "string",
            "number",
            "integer",
            "boolean",
            "object",
            ["object", "null"],
        ]:
            raise ValidationError(f"Unsupported widget field: {name}.")
        if set(field) - {
            "type",
            "title",
            "description",
            "default",
            "format",
            "enum",
            "minLength",
            "maxLength",
            "minimum",
            "maximum",
            "multipleOf",
            "controlType",
            "fieldType",
            "placeholder",
            "component",
            "componentType",
            "group",
            "editorPrimary",
            "multiple",
            "mediaTypes",
        }:
            raise ValidationError(f"Unsupported schema options for {name}.")
        if field.get("format") and field["format"] not in tuple(FORMATS):
            raise ValidationError(f"Unsupported field format: {name}.")
        if field["type"] in ["object", ["object", "null"]] and field.get("format") != "media":
            raise ValidationError("Only image fields may contain objects.")
        if field.get("controlType") not in (
            None,
            "text",
            "textarea",
            "rich_text",
            "image",
            "url",
            "number",
            "boolean",
            "choice",
        ):
            raise ValidationError(f"Unsupported control type: {name}.")
        if field.get("fieldType") not in (
            None,
            "text",
            "textarea",
            "rich_text",
            "image",
            "url",
            "number",
            "boolean",
            "choice",
        ):
            raise ValidationError(f"Unsupported field type: {name}.")
        if field.get("componentType") not in (
            None,
            "text",
            "textarea",
            "rich_text",
            "image",
            "url",
            "number",
            "boolean",
            "choice",
        ):
            raise ValidationError(f"Unsupported field component: {name}.")
        if field.get("component"):
            raise ValidationError("Custom field components are not supported.")
        if "default" in field and field["default"] is not None:
            try:
                jsonschema.Draft7Validator(field).validate(field["default"])
            except jsonschema.ValidationError as exc:
                raise ValidationError(f"Invalid default for {name}: {exc.message}") from exc
    order = schema.get("propertyOrder", list(properties))
    if (
        not isinstance(order, list)
        or any(not isinstance(name, str) or name not in properties for name in order)
        or len(set(order)) != len(order)
    ):
        raise ValidationError("Property order must contain unique existing field names.")
    if set(schema.get("required", [])) - properties.keys():
        raise ValidationError("Required fields must exist in the schema.")
    try:
        jsonschema.Draft7Validator.check_schema(schema)
    except jsonschema.SchemaError as exc:
        raise ValidationError(f"Invalid widget schema: {exc.message}") from exc


def compile_definition(definition, type_id, version):
    if not isinstance(definition, dict):
        raise ValidationError("Widget definition must be an object.")
    schema = copy.deepcopy(definition.get("schema", {"type": "object", "properties": {}}))
    validate_schema(schema)
    template = definition.get("template", "")
    if not isinstance(template, str) or len(template) > 100000:
        raise ValidationError("Widget template must be text up to 100000 characters.")
    if re.search(r"{{\s*[>=!]", template):
        raise ValidationError("Mustache partials, delimiters and comments are not supported.")
    validator = TemplateValidator(convert_charrefs=True)
    validator.feed(template)
    # Validate Mustache syntax independently from sample data.
    import chevron

    try:
        list(chevron.tokenizer.tokenize(template))
    except Exception as exc:
        raise ValidationError(f"Invalid Mustache template: {exc}") from exc
    css = definition.get("css", "")
    defaults = {
        key: copy.deepcopy(field["default"])
        for key, field in schema.get("properties", {}).items()
        if "default" in field and field["default"] is not None
    }
    return {
        "version": version,
        "schema": schema,
        "template": template,
        "css": css,
        "compiled_css": compile_css(css, type_id, version),
        "defaults": defaults,
    }


def _derived_base(document, base_type, base_version):
    """Resolve only exact, locally available non-derived bases."""
    if is_theme_widget(base_type):
        item = next((value for value in document["items"] if PREFIX + value["id"] == base_type), None)
        if item is None or type(base_version) is not int or base_version < 1:
            raise ValidationError(f"Missing published base widget revision: {base_type} v{base_version}.")
        release = next((value for value in item.get("releases", []) if value.get("version") == base_version), None)
        if release is None or release.get("kind") == "derived":
            raise ValidationError("A derived widget needs an existing non-derived base release.")
        return release["schema"], release["defaults"], {}, release
    if base_version is not None:
        raise ValidationError("Built-in widget bases do not have a theme release number.")
    from webpages.widget_registry import widget_type_registry

    base = widget_type_registry.get_widget_type_by_type(base_type) if isinstance(base_type, str) else None
    if base is None or not base.is_active:
        raise ValidationError(f"Unknown or inaccessible base widget: {base_type}.")
    return (
        base.configuration_model.model_json_schema(),
        base.get_configuration_defaults(),
        base.get_slot_definitions() or {},
        base,
    )


def compile_derived_definition(definition, type_id, version, document, *, historical=False):
    from webpages.slot_policies import permits_widget, validate_explicit_policy

    if not isinstance(definition, dict) or definition.get("kind") != "derived":
        raise ValidationError("Derived widget definition must be an object with kind derived.")
    if set(definition) - {"version", "kind", "base_type", "base_version", "defaults", "slot_policies"}:
        raise ValidationError("Derived widgets cannot replace the base schema, slots or renderer.")
    base_type = definition.get("base_type")
    if base_type == PREFIX + type_id:
        raise ValidationError("A widget cannot derive from itself.")
    base_version = definition.get("base_version")
    schema, base_defaults, slots, base = _derived_base(document, base_type, base_version)
    defaults = definition.get("defaults", {})
    if not isinstance(defaults, dict) or "slots" in defaults or set(defaults) - set(schema.get("properties", {})):
        raise ValidationError("Derived defaults must use inherited configuration fields.")
    combined = {**copy.deepcopy(base_defaults), **defaults}
    if is_theme_widget(base_type):
        base_item = next(item for item in document["items"] if PREFIX + item["id"] == base_type)
        errors = ThemeWidget(base_item, base, document).errors(copy.deepcopy(combined))
        if errors:
            raise ValidationError(f"Invalid inherited defaults: {errors}")
    else:
        valid, errors = base.validate_configuration(combined)
        if not valid:
            raise ValidationError(f"Invalid inherited defaults: {errors[0]}")
    policies = definition.get("slot_policies", {})
    if not isinstance(policies, dict) or set(policies) - set(slots):
        raise ValidationError("Derived slot policies must name inherited base slots.")
    for slot_name, policy in policies.items():
        validate_explicit_policy(
            policy, path=f"slot_policies.{slot_name}", required=slots[slot_name].get("required", False)
        )
        if policy["mode"] == "allow":
            for selected in policy["allowed_widget_types"]:
                if not _available_child_type(document, selected, include_archived=historical):
                    raise ValidationError(f"Unknown widget type '{selected}' in slot '{slot_name}'.")
                if not permits_widget(slots[slot_name], selected):
                    raise ValidationError(f"Slot '{slot_name}' cannot allow '{selected}' outside the base policy.")
    return {
        "version": version,
        "kind": "derived",
        "base_type": base_type,
        "base_version": base_version,
        "defaults": copy.deepcopy(defaults),
        "slot_policies": copy.deepcopy(policies),
    }


def _available_child_type(document, widget_type, *, include_archived=False):
    if is_theme_widget(widget_type):
        return any(
            PREFIX + item["id"] == widget_type
            and (include_archived or item.get("status", "active") == "active")
            and item.get("releases")
            for item in document["items"]
        )
    from webpages.widget_registry import widget_type_registry

    available = widget_type_registry.get_widget_type_by_type(widget_type) if isinstance(widget_type, str) else None
    return available is not None and available.is_active


def validate_widget_types(document, *, previous=None, draft=False):
    if (
        not isinstance(document, dict)
        or (type(document.get("version")) is not int or document.get("version") != 1)
        or not isinstance(document.get("items"), list)
    ):
        raise ValidationError("Widget types must contain version 1 and an items array.")
    if len(document["items"]) > 100:
        raise ValidationError("A theme supports at most 100 widget types.")
    previous_items = {item["id"]: item for item in (previous or empty_widget_types())["items"]}
    seen = set()
    for item in document["items"]:
        if not isinstance(item, dict):
            raise ValidationError("Widget type must be an object.")
        try:
            type_id = str(UUID(item.get("id", "")))
        except (ValueError, TypeError, AttributeError) as exc:
            raise ValidationError("Widget type needs a UUID.") from exc
        if item["id"] != type_id or type_id in seen:
            raise ValidationError("Widget type IDs must be unique canonical UUIDs.")
        seen.add(type_id)
        if not isinstance(item.get("name"), str) or not 1 <= len(item["name"].strip()) <= 160:
            raise ValidationError("Widget type needs a name up to 160 characters.")
        if not isinstance(item.get("description", ""), str) or len(item.get("description", "")) > 2000:
            raise ValidationError("Widget description must be text up to 2000 characters.")
        if not isinstance(item.get("example_data", {}), dict) or len(json.dumps(item.get("example_data", {}))) > 100000:
            raise ValidationError("Example data must be an object up to 100000 characters.")
        if item.get("status", "active") not in ("active", "archived"):
            raise ValidationError("Widget status must be active or archived.")
        releases = item.get("releases", [])
        if not isinstance(releases, list):
            raise ValidationError("Widget releases must be an array.")
        for number, release in enumerate(releases, 1):
            if not isinstance(release, dict) or type(release.get("version")) is not int:
                raise ValidationError("Release version must be an integer.")
            compiled = (
                compile_derived_definition(release, type_id, number, document, historical=True)
                if release.get("kind") == "derived"
                else compile_definition(release, type_id, number)
            )
            if release != compiled:
                raise ValidationError("Released widget definition or compiled CSS is invalid.")
        old = previous_items.get(type_id, {})
        old_releases = old.get("releases", [])
        if releases[: len(old_releases)] != old_releases:
            raise ValidationError("Published widget revisions cannot be changed or removed.")
        if old_releases and releases:
            first_base = old_releases[0].get("base_type")
            if any(release.get("base_type") != first_base for release in releases):
                raise ValidationError("A released widget's base identity cannot change.")
        active = item.get("active_version", len(releases))
        if type(active) is not int or (releases and not 1 <= active <= len(releases)) or (not releases and active != 0):
            raise ValidationError("Invalid active widget revision.")
        if "working" in item:
            if not draft:
                raise ValidationError("Unpublished definitions belong in the Designer draft.")
            working = item["working"]
            if not isinstance(working, dict):
                raise ValidationError("Working widget definition must be an object.")
            if working.get("kind") == "derived":
                if releases and working.get("base_type") != releases[0].get("base_type"):
                    raise ValidationError("A released widget's base identity cannot change.")
                if not releases and is_theme_widget(working.get("base_type")):
                    base_item = next(
                        (
                            candidate
                            for candidate in document["items"]
                            if PREFIX + candidate["id"] == working["base_type"]
                        ),
                        None,
                    )
                    if base_item is None or base_item.get("status", "active") != "active":
                        raise ValidationError("New derived widgets need an available, active base type.")
                compile_derived_definition(working, type_id, len(releases) + 1, document)
            else:
                if releases and releases[0].get("kind") == "derived":
                    raise ValidationError("A released derived widget cannot become a standalone widget.")
                compile_definition(working, type_id, len(releases) + 1)
    for key, item in previous_items.items():
        if item.get("releases") and key not in seen:
            raise ValidationError("Published widget types must be archived rather than removed.")
    return document


def publish_widget_types(document, previous):
    document = copy.deepcopy(document)
    validate_widget_types(document, previous=previous, draft=True)
    for item in document["items"]:
        working = item.pop("working", None)
        releases = item.setdefault("releases", [])
        if working is not None:
            release = (
                compile_derived_definition(working, item["id"], len(releases) + 1, document)
                if working.get("kind") == "derived"
                else compile_definition(working, item["id"], len(releases) + 1)
            )
            comparable = {key: value for key, value in release.items() if key not in {"version", "compiled_css"}}
            last = releases[-1] if releases else {}
            if comparable != {key: value for key, value in last.items() if key not in {"version", "compiled_css"}}:
                releases.append(release)
            item["active_version"] = len(releases)
    validate_widget_types(document, previous=previous)
    return document


def find_definition(theme, widget_type, version=None):
    for item in (getattr(theme, "widget_types", None) or empty_widget_types())["items"]:
        if PREFIX + item["id"] == widget_type:
            number = version if version is not None else item.get("active_version", len(item.get("releases", [])))
            if type(number) is not int or number < 1:
                return None
            return next(
                (
                    ThemeWidget(item, release, (getattr(theme, "widget_types", None) or empty_widget_types()))
                    for release in item.get("releases", [])
                    if release["version"] == number
                ),
                None,
            )
    return None


class ThemeWidget:
    def __init__(self, item, release, document=None):
        self.item, self.release = item, release
        self.document = document or empty_widget_types()
        self.type = PREFIX + item["id"]
        self.slug = self.type
        self.name = item["name"]
        self.description = item.get("description", "")
        self.is_active = item.get("status", "active") == "active"
        self.variants = []

    def get_configuration_defaults(self):
        if self.release.get("kind") == "derived":
            _, base_defaults, _, _ = self.base_definition()
            return {**copy.deepcopy(base_defaults), **copy.deepcopy(self.release["defaults"])}
        return copy.deepcopy(self.release["defaults"])

    def base_definition(self):
        return _derived_base(self.document, self.release["base_type"], self.release.get("base_version"))

    def get_slot_definitions(self):
        if self.release.get("kind") != "derived":
            return None
        _, _, slots, _ = self.base_definition()
        return {
            name: {**slot, "widget_policy": self.release["slot_policies"].get(name, {"mode": "inherit"})}
            for name, slot in slots.items()
        }

    def get_active_variants(self, config):
        return []

    def to_dict(self, **kwargs):
        schema = self.base_definition()[0] if self.release.get("kind") == "derived" else self.release["schema"]
        return {
            "type": self.type,
            "name": self.name,
            "description": self.description,
            "is_active": self.is_active,
            "type_version": self.release["version"],
            "latest_version": self.item.get("active_version", len(self.item["releases"])),
            "configuration_schema": schema,
            "schema": schema,
            "defaults": self.get_configuration_defaults(),
            "base_type": self.release.get("base_type"),
            "base_version": self.release.get("base_version"),
            "slot_policies": self.release.get("slot_policies", {}),
            "variants": [],
            "category": "theme",
        }

    def errors(self, config):
        errors = {}
        if not isinstance(config, dict):
            return {"_general": ["Widget configuration must be an object."]}
        if self.release.get("kind") == "derived":
            _, _, _, base = self.base_definition()
            if is_theme_widget(self.release["base_type"]):
                base_item = next(
                    item for item in self.document["items"] if PREFIX + item["id"] == self.release["base_type"]
                )
                return ThemeWidget(base_item, base, self.document).errors(config)
            valid, messages = base.validate_configuration(config)
            return {} if valid else {"_general": messages}
        # Reverse generic parser casing only for known frontend-owned schema keys.
        for name in self.release["schema"].get("properties", {}):
            legacy = re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()
            if legacy != name and legacy in config:
                if name in config and config[name] != config[legacy]:
                    errors.setdefault(name, []).append("Conflicting values for this field.")
                else:
                    config[name] = config.pop(legacy)
        for error in jsonschema.Draft7Validator(self.release["schema"]).iter_errors(config):
            key = str(next(iter(error.path), "_general"))
            if error.validator == "required":
                for name in error.validator_value:
                    if name not in config:
                        errors.setdefault(name, []).append("This field is required.")
            else:
                errors.setdefault(key, []).append(error.message)
        from urllib.parse import urlsplit

        for name, field in self.release["schema"].get("properties", {}).items():
            candidate = config.get(name)
            if field.get("format") == "uri" and isinstance(candidate, str) and candidate:
                try:
                    safe = candidate.startswith(("/", "#")) or urlsplit(candidate).scheme.lower() in {
                        "http",
                        "https",
                        "mailto",
                        "tel",
                    }
                except ValueError:
                    safe = False
                if not safe:
                    errors.setdefault(name, []).append("Enter a safe URL.")
        return errors

    def render(self, config):
        import chevron

        if self.release.get("kind") == "derived":
            _, _, _, base = self.base_definition()
            if is_theme_widget(self.release["base_type"]):
                return clean_html(chevron.render(base["template"], presentation_data(base["schema"], config)))
            raise ValidationError("Built-in derived widgets must render through their base renderer.")
        context = presentation_data(self.release["schema"], config)
        return clean_html(chevron.render(self.release["template"], context))


def presentation_data(schema, config):
    result = {}
    for name, field in schema.get("properties", {}).items():
        value = config.get(name, field.get("default", ""))
        if field.get("format") == "rich-text" or field.get("fieldType") == "rich_text":
            value = clean_html(value or "")
        if field.get("format") == "media" and isinstance(value, dict):
            value = {
                **value,
                "url": next(
                    (
                        value[key]
                        for key in (
                            "sourceUrl",
                            "source_url",
                            "imgproxyBaseUrl",
                            "imgproxy_base_url",
                            "fileUrl",
                            "file_url",
                            "publicUrl",
                            "public_url",
                            "absoluteUrl",
                            "absolute_url",
                            "downloadUrl",
                            "download_url",
                            "thumbnailUrl",
                            "thumbnail_url",
                            "url",
                        )
                        if value.get(key)
                    ),
                    "",
                ),
                "alt": value.get("alt", value.get("altText", value.get("alt_text", ""))),
            }
        result[name] = value
    return result


def iter_widgets(value):
    """Visit persisted widget trees, including widgets inside existing containers/objects."""
    if isinstance(value, list):
        for child in value:
            yield from iter_widgets(child)
    elif isinstance(value, dict):
        if is_theme_widget(value.get("type") or value.get("widget_type")):
            yield value
        for child in value.values():
            if isinstance(child, (dict, list)):
                yield from iter_widgets(child)


def validate_derived_slots(theme, widgets):
    """Check direct children against each pinned derived container policy."""
    from webpages.slot_policies import permits_widget

    def visit(widget):
        if not isinstance(widget, dict):
            raise ValidationError("Widget slot children must be objects.")
        widget_type = widget.get("type") or widget.get("widget_type")
        config = widget.get("config", {})
        slots = config.get("slots", {}) if isinstance(config, dict) else {}
        if not isinstance(slots, dict):
            raise ValidationError(f"Widget '{widget_type}' slots must be an object.")
        definition = (
            find_definition(theme, widget_type, widget.get("type_version", widget.get("typeVersion")))
            if is_theme_widget(widget_type)
            else None
        )
        if definition and definition.release.get("kind") == "derived":
            policies = definition.get_slot_definitions()
            if set(slots) - set(policies):
                raise ValidationError(f"Widget '{widget_type}' contains an unknown inherited slot.")
            for slot_name, policy in policies.items():
                children = slots.get(slot_name, [])
                if not isinstance(children, list):
                    raise ValidationError(f"Widget '{widget_type}' slot '{slot_name}' must contain a list.")
                maximum = policy.get("max_widgets")
                if maximum is not None and len(children) > maximum:
                    raise ValidationError(
                        f"Widget '{widget_type}' slot '{slot_name}' allows at most {maximum} widgets."
                    )
                if policy.get("required") and not children:
                    raise ValidationError(f"Widget '{widget_type}' slot '{slot_name}' requires content.")
                for child in children:
                    child_type = child.get("type") if isinstance(child, dict) else None
                    child_version = (
                        child.get("type_version", child.get("typeVersion")) if isinstance(child, dict) else None
                    )
                    available = (
                        find_definition(theme, child_type, child_version)
                        if is_theme_widget(child_type)
                        else _available_child_type(theme.widget_types, child_type)
                    )
                    if not available:
                        raise ValidationError(f"Unknown widget type '{child_type}' in slot '{slot_name}'.")
                    if not permits_widget(policy, child_type):
                        raise ValidationError(
                            f"Widget '{widget_type}' slot '{slot_name}' rejects widget type '{child_type}'."
                        )
        for children in slots.values():
            if isinstance(children, list):
                for child in children:
                    visit(child)

    if isinstance(widgets, dict):
        roots = widgets.values()
    elif isinstance(widgets, list):
        roots = [widgets]
    else:
        return
    for children in roots:
        if isinstance(children, list):
            for widget in children:
                visit(widget)


def validate_instances(theme, widgets, *, previous_theme=None, previous_widgets=None, warnings=None):
    errors = []
    previous_references = (
        None
        if previous_widgets is None
        else {
            (
                str(widget.get("id")),
                widget.get("type") or widget.get("widget_type"),
                widget.get("type_version", widget.get("typeVersion")),
            )
            for widget in iter_widgets(previous_widgets)
        }
    )
    for widget in iter_widgets(widgets):
        widget_type = widget.get("type") or widget.get("widget_type")
        version = widget.get("type_version", widget.get("typeVersion"))
        if "type_version" in widget and "typeVersion" in widget and widget["type_version"] != widget["typeVersion"]:
            raise ValidationError("Conflicting widget type revisions.")
        definition = find_definition(theme, widget_type, version) if type(version) is int else None
        label = widget.get("id", widget_type)
        if definition is None:
            errors.append(f"Widget {label}: missing type revision {widget_type} v{version} in the effective theme.")
            continue
        reference = (str(widget.get("id")), widget_type, version)
        if previous_theme is not None and (previous_references is None or reference in previous_references):
            old = find_definition(previous_theme, widget_type, version)
            if old is None or old.release != definition.release:
                errors.append(f"Widget {label}: target theme has a different definition of {widget_type} v{version}.")
        config = widget.get("config", {})
        widget["type_version"] = version
        widget.pop("typeVersion", None)
        field_errors = definition.errors(config)
        if field_errors:
            errors.append(f"Widget {label}: {json.dumps(field_errors)}")
    if errors:
        if warnings is not None:
            warnings.extend(errors)
        else:
            raise ValidationError(errors)
    if theme is not None:
        validate_derived_slots(theme, widgets)


def resolve_widget(theme, widget_type, version=None):
    if is_theme_widget(widget_type):
        return find_definition(theme, widget_type, version)
    from webpages.widget_registry import widget_type_registry

    return widget_type_registry.get_widget_type_flexible(widget_type)


def retain_released_history(restored, current):
    """Restore active revisions while retaining all releases needed by historical content."""
    result = copy.deepcopy(restored or empty_widget_types())
    by_id = {item["id"]: item for item in result["items"]}
    for old in current["items"]:
        item = by_id.get(old["id"])
        if item is None:
            item = copy.deepcopy(old)
            item["status"] = "archived"
            result["items"].append(item)
        else:
            releases = item.get("releases", [])
            if releases != old["releases"][: len(releases)]:
                raise ValidationError("Restored widget history conflicts with an immutable release.")
            item["releases"] = copy.deepcopy(old["releases"])
    return result


_INHERIT_THEME = object()


def version_widget_theme(
    instance, *, theme_override=_INHERIT_THEME, ancestor_override=None, at=None, published_ancestors=None
):
    """Use draft ancestors for working versions and published ancestors for live versions."""
    from django.utils import timezone

    from webpages.models import PageTheme

    if at is None and instance.effective_date is not None and instance.effective_date > timezone.now():
        at = instance.effective_date
    published_ancestors = instance.effective_date is not None if published_ancestors is None else published_ancestors
    explicit = instance.theme if theme_override is _INHERIT_THEME else theme_override
    if explicit is not None:
        return explicit
    current = instance.page.parent
    while current:
        if ancestor_override is not None and current.pk == ancestor_override[0]:
            return ancestor_override[1]
        version = current.get_current_published_version(now=at) if published_ancestors else current.get_latest_version()
        if version and version.theme_id:
            return version.theme
        current = current.parent
    return PageTheme.objects.filter(tenant_id=instance.page.tenant_id, is_default=True, is_active=True).first()


def version_theme_boundaries(instance, *, extra=()):
    """Known ancestor activations/expiries while this published or scheduled version is active."""
    from django.utils import timezone

    if instance.effective_date is None:
        return [None]
    start = max(timezone.now(), instance.effective_date)
    end = instance.expiry_date
    if end is not None and end <= start:
        return []
    points = {start}
    current = instance.page.parent
    while current:
        for effective, expiry in current.versions.values_list("effective_date", "expiry_date"):
            for point in (effective, expiry):
                if point is not None and point >= start and (end is None or point < end):
                    points.add(point)
        current = current.parent
    points.update(point for point in extra if point is not None and point >= start and (end is None or point < end))
    return sorted(points)


def proposed_page_theme(instance, at):
    """Resolve the ancestor selection after replacing/inserting one page version."""
    from django.db.models import Q

    versions = type(instance).objects.filter(page_id=instance.page_id).exclude(pk=instance.pk)
    if at is None:
        selected = versions.order_by("-version_number").first()
        if selected is None or instance.version_number >= selected.version_number:
            selected = instance
    else:
        selected = (
            versions.filter(effective_date__lte=at)
            .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=at))
            .order_by("-effective_date", "-version_number")
            .first()
        )
        candidate_active = (
            instance.effective_date is not None
            and instance.effective_date <= at
            and (instance.expiry_date is None or instance.expiry_date > at)
        )
        if candidate_active and (
            selected is None
            or (instance.effective_date, instance.version_number) >= (selected.effective_date, selected.version_number)
        ):
            selected = instance
    return version_widget_theme(
        instance,
        theme_override=selected.theme if selected else None,
        at=at,
        published_ancestors=at is not None,
    )


def validate_version_widgets(instance):
    if not instance.widgets:
        return
    from webpages.models import PageTheme

    if hasattr(instance, "page_id"):
        theme = version_widget_theme(instance)
        previous = (
            type(instance).objects.filter(pk=instance.pk).select_related("theme").first()
            if instance.pk
            else instance.page.get_latest_version()
        )
        previous_theme = None
        if previous:
            old_theme = version_widget_theme(previous)
            if getattr(old_theme, "id", None) != getattr(theme, "id", None):
                previous_theme = old_theme
        if theme is not None and theme.tenant_id != instance.page.tenant_id:
            raise ValidationError("Widget theme must belong to the page tenant.")
    else:
        theme = PageTheme.objects.filter(
            tenant_id=instance.object_instance.tenant_id, is_default=True, is_active=True
        ).first()
        previous_theme = None
    validate_instances(
        theme,
        instance.widgets,
        previous_theme=previous_theme,
        previous_widgets=previous.widgets if hasattr(instance, "page_id") and previous else None,
    )
    if hasattr(instance, "page_id"):
        from webpages.theme_layouts import validate_layout_widgets

        layout_key = instance.layout_key or instance.code_layout
        current = instance.page.parent
        while not layout_key and current:
            parent_version = (
                current.get_latest_version()
                if instance.effective_date is None
                else current.get_current_published_version(now=instance.effective_date)
            )
            layout_key = (parent_version.layout_key or parent_version.code_layout) if parent_version else None
            current = current.parent
        if not layout_key and theme:
            layout_key = (theme.layouts or {}).get("default_layout_key")
        validate_layout_widgets(
            theme,
            layout_key,
            instance.widgets,
            previous_widgets=previous.widgets if previous else None,
        )
        for at in version_theme_boundaries(instance):
            future_theme = version_widget_theme(instance, at=at)
            if getattr(future_theme, "pk", None) != getattr(theme, "pk", None):
                validate_instances(future_theme, instance.widgets, previous_theme=theme)


def validate_default_theme_change(theme, *, previous_theme=None):
    """A default-theme switch also affects objects and pages without an explicit theme."""
    if theme is not None and not theme.is_default:
        return
    from object_storage.models import ObjectVersion
    from webpages.models import PageTheme, PageVersion

    old = previous_theme or (
        PageTheme.objects.filter(tenant_id=theme.tenant_id, is_default=True).exclude(pk=theme.pk).first()
        if theme is not None
        else None
    )
    if old is None:
        return
    for version in ObjectVersion.objects.filter(object_instance__tenant_id=old.tenant_id).only("widgets").iterator():
        validate_instances(theme, version.widgets, previous_theme=old)
    for version in (
        PageVersion.objects.filter(page__tenant_id=old.tenant_id, theme__isnull=True)
        .select_related("page__parent")
        .iterator()
    ):
        if not any(iter_widgets(version.widgets)):
            continue
        for at in [None, *version_theme_boundaries(version)]:
            inherited = version_widget_theme(version, at=at)
            if inherited and inherited.pk == old.pk:
                validate_instances(theme, version.widgets, previous_theme=old)
                break


def validate_page_theme_change(instance):
    """Preflight every known inherited theme boundary affected by this version write."""
    previous = type(instance).objects.filter(pk=instance.pk).first() if instance.pk else None
    if previous and (previous.theme_id, previous.effective_date, previous.expiry_date) == (
        instance.theme_id,
        instance.effective_date,
        instance.expiry_date,
    ):
        return
    extra = (instance.effective_date, instance.expiry_date)
    pending = list(instance.page.children.filter(tenant_id=instance.page.tenant_id))
    while pending:
        child = pending.pop()
        for version in type(instance).objects.filter(page=child, theme__isnull=True).select_related("page__parent"):
            if not any(iter_widgets(version.widgets)):
                continue
            for at in version_theme_boundaries(version, extra=extra):
                old_theme = version_widget_theme(version, at=at)
                proposed = proposed_page_theme(instance, at)
                target = version_widget_theme(version, ancestor_override=(instance.page_id, proposed), at=at)
                if getattr(target, "pk", None) != getattr(old_theme, "pk", None):
                    validate_instances(target, version.widgets, previous_theme=old_theme)
        pending.extend(child.children.filter(tenant_id=instance.page.tenant_id))


def object_widget_theme(tenant_id):
    """Object definitions follow their tenant default; page-wide tokens stay on the page theme."""
    from webpages.models import PageTheme

    return PageTheme.objects.filter(tenant_id=tenant_id, is_default=True, is_active=True).first()
