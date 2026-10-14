from dataclasses import dataclass, field


class PluginRegistryError(RuntimeError):
    pass


@dataclass(frozen=True)
class ImporterDefinition:
    id: str
    version: str
    label: str
    description: str
    connection_kinds: tuple[str, ...]
    capabilities: tuple[str, ...]
    fields: tuple[dict, ...]
    handler: type

    def as_dict(self):
        return {
            "id": self.id,
            "version": self.version,
            "label": self.label,
            "description": self.description,
            "connectionKinds": list(self.connection_kinds),
            "capabilities": list(self.capabilities),
            "fields": list(self.fields),
        }


@dataclass(frozen=True)
class PluginDefinition:
    id: str
    version: str
    label: str
    description: str
    kind: str
    allowed_tenants: tuple[str, ...]
    importers: tuple[ImporterDefinition, ...] = field(default_factory=tuple)
    status: str = "available"

    def supports_tenant(self, tenant):
        return not self.allowed_tenants or tenant.identifier in self.allowed_tenants

    def as_dict(self, *, active=False, compatible=True):
        return {
            "id": self.id,
            "version": self.version,
            "label": self.label,
            "description": self.description,
            "kind": self.kind,
            "status": self.status,
            "active": active,
            "compatible": compatible,
            "importerCount": len(self.importers),
        }


class PluginRegistry:
    def __init__(self):
        self._plugins = {}
        self._importers = {}

    def register(self, plugin):
        if plugin.id in self._plugins:
            raise PluginRegistryError(f"Plugin {plugin.id} is already registered")
        for importer in plugin.importers:
            if importer.id in self._importers:
                raise PluginRegistryError(f"Importer {importer.id} is already registered")
        self._plugins[plugin.id] = plugin
        for importer in plugin.importers:
            self._importers[importer.id] = (plugin, importer)

    def plugins(self):
        return tuple(self._plugins.values())

    def plugin(self, plugin_id):
        try:
            return self._plugins[plugin_id]
        except KeyError as exc:
            raise PluginRegistryError("The requested plugin is not installed.") from exc

    def importer(self, importer_id):
        try:
            return self._importers[importer_id]
        except KeyError as exc:
            raise PluginRegistryError("The requested importer is not installed.") from exc


registry = PluginRegistry()
