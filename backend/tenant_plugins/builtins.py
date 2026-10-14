from .eceee_legacy import PLUGIN as ECEEE_LEGACY_PLUGIN
from .eceee_proceedings import PLUGIN as ECEEE_PROCEEDINGS_PLUGIN
from .registry import registry


registry.register(ECEEE_LEGACY_PLUGIN)
registry.register(ECEEE_PROCEEDINGS_PLUGIN)
