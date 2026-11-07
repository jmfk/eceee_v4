"""Widget slot restrictions shared by layouts and derived widget releases."""

from django.core.exceptions import ValidationError


def matches_widget_type(widget_type, patterns):
    """Legacy wildcards match the actual identity, never an inherited base."""
    return any(
        pattern == "*" or pattern == widget_type or (pattern.endswith(".*") and widget_type.startswith(pattern[:-1]))
        for pattern in patterns
    )


def permits_widget(policy, widget_type):
    explicit = policy.get("widget_policy") if isinstance(policy, dict) else None
    if explicit is None and isinstance(policy, dict) and policy.get("mode") in {"inherit", "allow", "none"}:
        explicit = policy
    if explicit is not None:
        mode = explicit.get("mode")
        if mode == "none":
            return False
        if mode == "allow" and widget_type not in explicit.get("allowed_widget_types", []):
            return False
    allowed = policy.get("allowed_widget_types") or []
    disallowed = policy.get("disallowed_widget_types") or []
    return (not allowed or matches_widget_type(widget_type, allowed)) and not matches_widget_type(
        widget_type, disallowed
    )


def validate_explicit_policy(policy, *, path, required=False):
    if not isinstance(policy, dict) or policy.get("mode") not in {"inherit", "allow", "none"}:
        raise ValidationError(f"{path}.mode must be inherit, allow or none.")
    if set(policy) - {"mode", "allowed_widget_types"}:
        raise ValidationError(f"{path} contains unsupported fields.")
    selected = policy.get("allowed_widget_types", [])
    if not isinstance(selected, list) or any(not isinstance(value, str) or not value for value in selected):
        raise ValidationError(f"{path}.allowed_widget_types must be a list of type IDs.")
    if policy["mode"] == "allow":
        if not selected or len(set(selected)) != len(selected) or any("*" in value for value in selected):
            raise ValidationError(f"{path}.allowed_widget_types must select distinct exact type IDs.")
    elif selected:
        raise ValidationError(f"{path}.allowed_widget_types is only valid in allow mode.")
    if required and policy["mode"] == "none":
        raise ValidationError(f"{path} cannot block a required slot.")
    return policy
