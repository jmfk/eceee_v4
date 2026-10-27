"""Compile the reviewed site-2 term decisions into portable target terms."""

import hashlib
import json
import re
import unicodedata
from collections import defaultdict
from copy import deepcopy
from functools import lru_cache
from pathlib import Path

from .profile import CLASSIFICATIONS, initial_bundle

HERE = Path(__file__).resolve().parent
INVENTORY = HERE / "site2_terms.json"
DECISIONS = HERE / "site2_decisions.json"
PLAN_VERSION = 2
RESOURCE_TARGETS = {
    "news": "article",
    "columns": "article",
    "columnists": "columnist",
    "events": "event",
    "organizations": "organization",
}


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
    ).hexdigest()


def identity(site, dimension, model, source_id):
    return f"{site}:{dimension}:{model}:{source_id}"


def _slug(value):
    ascii_name = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", ascii_name).strip("-")[:150] or "term"


def _source_slug(term):
    source = identity(2, term["dimension"], term["model"], term["id"])
    return f'{_slug(term["name"])}-{hashlib.sha256(source.encode()).hexdigest()[:10]}'


def load_plan():
    return json.loads(INVENTORY.read_text()), json.loads(DECISIONS.read_text())


@lru_cache(maxsize=1)
def source_names():
    inventory, _ = load_plan()
    return {
        identity(inventory["sourceSite"], term["dimension"], term["model"], term["id"]): term["name"]
        for term in inventory["terms"]
    }


def compile_plan(inventory=None, decisions=None):
    inventory, decisions = (inventory, decisions) if inventory is not None and decisions is not None else load_plan()
    if (
        inventory.get("format") != "eceee-legacy-term-inventory"
        or decisions.get("format") != "eceee-legacy-term-decisions"
        or inventory.get("sourceSite") != 2
        or decisions.get("sourceSite") != 2
    ):
        raise ValueError("term_plan=wrong_format_or_site")
    if inventory.get("version") != 1 or decisions.get("version") != 1:
        raise ValueError("term_plan=unsupported_version")
    source_terms = inventory["terms"]
    if len(source_terms) != 698:
        raise ValueError("term_plan=inventory_count_changed")
    by_dimension = defaultdict(dict)
    source_ids = set()
    for term in source_terms:
        dimension, source_id = term["dimension"], str(term["id"])
        key = identity(2, dimension, term["model"], source_id)
        if key in source_ids or source_id in by_dimension[dimension] or term.get("parent"):
            raise ValueError("term_plan=duplicate_identity_or_unreviewed_source_hierarchy")
        target_type = decisions["targetTypes"].get(dimension)
        if target_type not in CLASSIFICATIONS or any(
            RESOURCE_TARGETS.get(resource) not in CLASSIFICATIONS[target_type][1] for resource in term["uses"]
        ):
            raise ValueError("term_plan=invalid_target_use")
        source_ids.add(key)
        by_dimension[dimension][source_id] = term
    if set(by_dimension) != set(decisions["targetTypes"]):
        raise ValueError("term_plan=dimension_mismatch")

    group_for = {}
    synthetic = {}
    for dimension, groups in decisions["groups"].items():
        if dimension not in by_dimension:
            raise ValueError("term_plan=unknown_group_dimension")
        seen = set()
        for group_name, ids in groups.items():
            key = (dimension, group_name)
            if key in synthetic:
                raise ValueError("term_plan=duplicate_group")
            synthetic[key] = {"name": group_name, "parent": None}
            for raw_id in ids:
                source_id = str(raw_id)
                if source_id in seen or source_id not in by_dimension[dimension]:
                    raise ValueError("term_plan=missing_or_duplicate_group_term")
                seen.add(source_id)
                group_for[(dimension, source_id)] = group_name
        expected = set(by_dimension[dimension])
        roots = {str(v) for v in decisions.get("root", {}).get(dimension, [])}
        if seen & roots or seen | roots != expected:
            raise ValueError("term_plan=incomplete_group")
    for dimension, extras in decisions.get("synthetic", {}).items():
        for item in extras:
            key = (dimension, item["name"])
            if key in synthetic:
                raise ValueError("term_plan=duplicate_synthetic_term")
            synthetic[key] = item

    canonical_for = {(dim, sid): sid for dim, terms in by_dimension.items() for sid in terms}
    synthetic_for = {}
    for dimension, merges in decisions["merges"].items():
        used = set()
        for merge in merges:
            ids = [str(value) for value in merge["ids"]]
            if len(ids) < 2 or len(ids) != len(set(ids)) or used.intersection(ids):
                raise ValueError("term_plan=overlapping_merge")
            if any(source_id not in by_dimension[dimension] for source_id in ids):
                raise ValueError("term_plan=unknown_merge_identity")
            used.update(ids)
            if "canonical" in merge:
                canonical = str(merge["canonical"])
                if canonical not in ids:
                    raise ValueError("term_plan=invalid_canonical_term")
                if len({group_for.get((dimension, source_id)) for source_id in ids}) != 1:
                    raise ValueError("term_plan=cross_group_merge")
                for source_id in ids:
                    canonical_for[(dimension, source_id)] = canonical
            else:
                target = merge["target"]
                if (dimension, target) not in synthetic:
                    raise ValueError("term_plan=unknown_synthetic_target")
                for source_id in ids:
                    synthetic_for[(dimension, source_id)] = target
    if synthetic_for != {("sources", "4"): "Okänd källa", ("sources", "17"): "Okänd källa"}:
        raise ValueError("term_plan=unexpected_blank_source_rule")
    if any(
        not term["name"].strip() and (term["dimension"], str(term["id"])) not in synthetic_for for term in source_terms
    ):
        raise ValueError("term_plan=unmapped_empty_name")

    parent_for = {}
    for dimension, children in decisions.get("children", {}).items():
        for child_id, raw_parent in children.items():
            child_id = str(child_id)
            if child_id not in by_dimension[dimension]:
                raise ValueError("term_plan=unknown_child")
            parent = str(raw_parent)
            if parent in by_dimension[dimension]:
                parent_for[(dimension, child_id)] = ("source", canonical_for[(dimension, parent)])
            elif (dimension, parent) in synthetic:
                parent_for[(dimension, child_id)] = ("synthetic", parent)
            else:
                raise ValueError("term_plan=unknown_parent")

    names = decisions.get("names", {})
    portable = {}
    refs = {}
    alias_sets = defaultdict(set)
    for dimension, terms in by_dimension.items():
        target_type = decisions["targetTypes"][dimension]
        for source_id, term in terms.items():
            key = identity(2, dimension, term["model"], source_id)
            if (dimension, source_id) in synthetic_for:
                name = synthetic_for[(dimension, source_id)]
                slug = "group-" + _slug(name)
            else:
                canonical_id = canonical_for[(dimension, source_id)]
                canonical = terms[canonical_id]
                name = names.get(dimension, {}).get(canonical_id, canonical["name"])
                slug = _source_slug(canonical)
            ref = (target_type, slug)
            refs[key] = {"type": target_type, "slug": slug}
            if ref not in portable:
                portable[ref] = {"type": target_type, "slug": slug, "name": name, "parent": None}
            if term["name"] and term["name"] != name:
                alias_sets[ref].add(term["name"])
            if (dimension, source_id) not in synthetic_for:
                canonical_id = canonical_for[(dimension, source_id)]
                parent = parent_for.get((dimension, canonical_id))
                if parent is None and (dimension, source_id) in parent_for:
                    parent = parent_for[(dimension, source_id)]
                if parent is None and (dimension, canonical_id) in group_for:
                    parent = ("synthetic", group_for[(dimension, canonical_id)])
                if parent:
                    if parent[0] == "source":
                        parent_term = terms[parent[1]]
                        parent_slug = _source_slug(parent_term)
                    else:
                        parent_slug = "group-" + _slug(parent[1])
                    old_parent = portable[ref]["parent"]
                    if old_parent is not None and old_parent != parent_slug:
                        raise ValueError("term_plan=conflicting_merged_parents")
                    portable[ref]["parent"] = parent_slug

    for (dimension, name), item in synthetic.items():
        ref = (decisions["targetTypes"][dimension], "group-" + _slug(name))
        if ref in portable and portable[ref]["name"] != name:
            raise ValueError("term_plan=synthetic_slug_conflict")
        parent = item.get("parent")
        portable.setdefault(
            ref,
            {
                "type": ref[0],
                "slug": ref[1],
                "name": name,
                "parent": "group-" + _slug(parent) if parent else None,
            },
        )
    for ref, aliases in alias_sets.items():
        portable[ref]["alternative_names"] = sorted(aliases)
    for term in portable.values():
        term.setdefault("alternative_names", [])
        if term["parent"] == term["slug"]:
            raise ValueError("term_plan=self_parent")
        if term["parent"] and (term["type"], term["parent"]) not in portable:
            raise ValueError("term_plan=missing_target_parent")
    visiting, complete = set(), set()

    def visit(ref):
        if ref in visiting:
            raise ValueError("term_plan=parent_cycle")
        if ref in complete:
            return
        visiting.add(ref)
        parent = portable[ref]["parent"]
        if parent:
            visit((ref[0], parent))
        visiting.remove(ref)
        complete.add(ref)

    for ref in portable:
        visit(ref)
    bundle = deepcopy(initial_bundle())
    bundle["terms"].extend(sorted(portable.values(), key=lambda term: (term["type"], term["slug"])))
    mapping = {
        "format": "eceee-reviewed-legacy-term-map",
        "version": PLAN_VERSION,
        "sourceSite": 2,
        "inventoryDigest": digest(inventory),
        "decisionsDigest": digest(decisions),
        "termRefs": dict(sorted(refs.items())),
        "pressReleaseSourceTerms": ["4"],
    }
    review_rows = []
    for source in source_terms:
        source_key = identity(2, source["dimension"], source["model"], source["id"])
        ref = mapping["termRefs"][source_key]
        target = portable[(ref["type"], ref["slug"])]
        review_rows.append(
            {
                "sourceSite": 2,
                "dimension": source["dimension"],
                "model": source["model"],
                "sourceId": source["id"],
                "sourceName": source["name"],
                "uses": source["uses"],
                "targetType": target["type"],
                "targetSlug": target["slug"],
                "targetName": target["name"],
                "aliases": target["alternative_names"],
                "parent": target["parent"],
            }
        )
    return {"bundle": bundle, "mapping": mapping, "reviewRows": review_rows}
