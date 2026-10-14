from .registry import PluginDefinition

PLUGIN = PluginDefinition(
    id="org.eceee.proceedings",
    version="1",
    label="ECEEE Proceedings",
    description="Long-lived proceedings functionality with a direct FileMaker connector.",
    kind="feature",
    allowed_tenants=("eceee", "eceee_org", "eceee-production-copy"),
    status="foundation",
)
