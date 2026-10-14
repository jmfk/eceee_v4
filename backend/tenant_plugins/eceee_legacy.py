from content_migration.plugins.eceee_legacy import LegacyNewsImporter

from .registry import ImporterDefinition, PluginDefinition

PLUGIN = PluginDefinition(
    id="org.eceee.legacy_import",
    version="1",
    label="ECEEE Legacy Import",
    description="Guided, resumable migrations from the deprecated ECEEE CMS.",
    kind="import",
    # Keep the installed ECEEE capability available to both the canonical
    # workspace and the production-copy workspace used for migration testing.
    allowed_tenants=("eceee", "eceee_org", "eceee-production-copy"),
    importers=(
        ImporterDefinition(
            id="org.eceee.legacy_import.news",
            version="1",
            label="Legacy News",
            description="Import published News objects with taxonomy, media, and reconciled links.",
            connection_kinds=("LEGACY_POSTGRES",),
            capabilities=("includes_media", "rewrites_links", "resumable"),
            fields=(
                {"name": "namespace", "type": "namespace", "label": "Target namespace", "required": True},
                {
                    "name": "limit",
                    "type": "integer",
                    "label": "Latest published items",
                    "default": 100,
                    "minimum": 1,
                    "maximum": 500,
                    "required": True,
                },
                {
                    "name": "newestFirst",
                    "type": "boolean",
                    "label": "Import newest items first",
                    "default": True,
                },
                {
                    "name": "resume",
                    "type": "boolean",
                    "label": "Resume and retry placeholder media",
                    "default": True,
                },
            ),
            handler=LegacyNewsImporter,
        ),
    ),
)
