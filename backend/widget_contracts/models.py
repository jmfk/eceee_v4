"""Pydantic adapter for the shared pilot definitions; no Django imports.

Pydantic remains authoritative in the CMS. The Node validator runs in comparison
only until its compatibility evidence justifies a separately reviewed cutover.
The five original models have no custom validators or default factories.
"""

from typing import Any, Dict, List, Literal, Optional

from pydantic import ConfigDict, Field, create_model
from pydantic.alias_generators import to_camel

from . import pilot_models

_DEFINITIONS = pilot_models()
_MODELS = {}


def _annotation(spec):
    if "nullable" in spec:
        inner = _annotation(spec["nullable"])
        return Optional[inner]
    if "literal" in spec:
        return Literal[tuple(spec["literal"])]
    if "list" in spec:
        return List[_annotation(spec["list"])]
    if "dict" in spec:
        return Dict[str, _annotation(spec["dict"])]
    if "model" in spec:
        return _build_model(spec["model"])
    return {"str": str, "bool": bool, "dict": dict, "any": Any}[spec["type"]]


def _build_model(name):
    if name in _MODELS:
        return _MODELS[name]
    definition = _DEFINITIONS["models"][name]
    fields = {}
    for field in definition["fields"]:
        options = {key: field[key] for key in ("min_length", "max_length", "ge", "le", "pattern") if key in field}
        options.update(alias=field["alias"], description=field["description"])
        if "ui" in field:
            options["json_schema_extra"] = field["ui"]
        fields[field["name"]] = (
            _annotation(field["annotation"]),
            Field(field.get("default", ...), **options),
        )
    model = create_model(
        name,
        __config__=ConfigDict(alias_generator=to_camel, populate_by_name=True),
        __doc__=definition["description"],
        __module__=__name__,
        **fields,
    )
    _MODELS[name] = model
    return model


HeadlineConfig = _build_model("HeadlineConfig")
BannerConfig = _build_model("BannerConfig")
TwoColumnsConfig = _build_model("TwoColumnsConfig")
FormField = _build_model("FormField")
FormsConfig = _build_model("FormsConfig")
