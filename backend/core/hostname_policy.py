"""Tenant hostname grants, stored in Tenant.settings for compatibility."""

from django.core.exceptions import ValidationError


def policy_for(tenant):
    # Existing tenants keep their current ability to manage hostnames.
    return (tenant.settings or {}).get("hostname_policy") or {"mode": "unrestricted", "values": []}


def hostname_allowed(tenant, hostname):
    from webpages.models import WebPage

    policy = policy_for(tenant)
    mode = policy.get("mode")
    value = WebPage.normalize_hostname(hostname)
    if mode == "unrestricted":
        return True
    if value in ("*", "default"):
        return False
    grants = policy.get("values") or []
    if mode == "exact":
        return value in grants
    if mode == "domains":
        base = value[2:] if value.startswith("*.") else value
        return any(base == domain or base.endswith("." + domain) for domain in grants)
    return False


def validate_hostnames(tenant, hostnames):
    for hostname in hostnames or []:
        if not hostname_allowed(tenant, hostname):
            raise ValidationError({"hostnames": f"Hostname '{hostname}' is not allowed for this workspace."})
