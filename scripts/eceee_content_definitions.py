#!/usr/bin/env python3
"""Install, diff or export a portable API-owned ECEEE editorial definition bundle."""
import argparse
import hashlib
import importlib.util
import json
import sys
import urllib.error
import urllib.request
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills/eceee-api-operations/scripts"))
import eceee_api  # noqa: E402

NoRedirectHandler = eceee_api.NoRedirectHandler
read_env_file = eceee_api.read_env_file
resolve_profile = eceee_api.resolve_profile

spec = importlib.util.spec_from_file_location(
    "content_profile", ROOT / "backend/content_migration/legacy_content/profile.py"
)
profile = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profile)

WIRE_KEYS = {
    "pluralLabel": "plural_label",
    "slotConfiguration": "slot_configuration",
    "hierarchyLevel": "hierarchy_level",
    "isActive": "is_active",
    "isDefault": "is_default",
    "browserGroup": "browser_group",
    "allowedUses": "allowed_uses",
    "sortOrder": "sort_order",
    "contentProfile": "content_profile",
    "classificationType": "classification_type",
    "tagType": "tag_type",
    "mergedInto": "merged_into",
    "alternativeNames": "alternative_names",
    "fieldType": "field_type",
    "allowedObjectTypes": "allowed_object_types",
    "relationshipType": "relationship_type",
    "allowedWidgets": "allowed_widgets",
    "namespaceId": "namespace_id",
}


def normalize_wire(value):
    if isinstance(value, list):
        return [normalize_wire(v) for v in value]
    if isinstance(value, dict):
        return {WIRE_KEYS.get(k, k): normalize_wire(v) for k, v in value.items()}
    return value


class Api:
    def __init__(self, env_file, selected_profile="dev", tenant=None):
        values = read_env_file(Path(env_file))
        self.base, self.tenant, key = resolve_profile(values, selected_profile, tenant=tenant)
        self.key = values.get(key)
        if not self.key:
            raise ValueError("credential=missing")
        self.opener = urllib.request.build_opener(NoRedirectHandler())

    def request(self, path, method="GET", data=None):
        if not path.startswith(("objects/", "taxonomy/", "content/namespaces/")) or ".." in path.split("/"):
            raise ValueError("definition_endpoint=invalid")
        request = urllib.request.Request(
            self.base + path,
            method=method,
            data=json.dumps(data).encode() if data is not None else None,
            headers={
                "Authorization": "ApiKey " + self.key,
                "X-Tenant-ID": self.tenant,
                "Content-Type": "application/json",
            },
        )
        try:
            with self.opener.open(request, timeout=60) as response:
                return normalize_wire(json.load(response))
        except urllib.error.HTTPError as error:
            # CMS payloads can include private data; only emit bounded transport status.
            raise ValueError(f'definition_api=http_{error.code} endpoint={path.split("?")[0]}') from None

    def list(self, path):
        result = []
        page = 1
        while True:
            data = self.request(path + ("&" if "?" in path else "?") + f"page_size=200&page={page}")
            result.extend(data if isinstance(data, list) else data.get("results", []))
            if isinstance(data, list) or not data.get("next"):
                return result
            page += 1


def digest(bundle):
    return hashlib.sha256(
        json.dumps(bundle, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    ).hexdigest()


def reject_conflicting_terms(api, ns, bundle):
    """Fail before definition writes if a portable term collides with existing taxonomy."""

    existing_types = {str(t["id"]): t["key"] for t in api.list("taxonomy/types/?namespace=" + str(ns["id"]))}
    rows = api.list("taxonomy/terms/?namespace=" + str(ns["id"]))
    by_id = {str(row["id"]): row for row in rows}
    by_ref = {(existing_types.get(str(row["classification_type"])), row["slug"]): row for row in rows}
    for desired in bundle["terms"]:
        current = by_ref.get((desired["type"], desired["slug"]))
        if not current:
            continue
        parent = by_id.get(str(current["parent"])) if current.get("parent") else None
        if (
            current["name"] != desired["name"]
            or current["status"] != "approved"
            or (parent["slug"] if parent else None) != desired.get("parent")
            or (
                "alternative_names" in desired
                and sorted(current.get("alternative_names") or []) != sorted(desired["alternative_names"])
            )
        ):
            raise ValueError("bundle_term=conflict")


def namespace(api, slug, apply=False):
    found = [n for n in api.list("content/namespaces/") if n["slug"] == slug]
    if found:
        return found[0]
    if apply:
        return api.request(
            "content/namespaces/",
            "POST",
            {"name": "ECEEE editorial content", "slug": slug, "is_active": True, "is_default": True},
        )
    return None


def export_bundle(api, ns):
    definitions = []
    id_names = {}
    for row in api.list("objects/object-types/"):
        detail = api.request(f'objects/object-types/{row["id"]}/')
        id_names[detail["id"]] = detail["name"]
        if detail["name"] in profile.OBJECT_TYPES and detail.get("namespace", {}).get("id") == ns["id"]:
            definitions.append(detail)
    if len(definitions) != len(profile.OBJECT_TYPES):
        raise ValueError("definition_export=incomplete_profile")
    allowed = {
        "name",
        "label",
        "plural_label",
        "description",
        "schema",
        "slot_configuration",
        "hierarchy_level",
        "is_active",
        "metadata",
    }
    portable = []
    for row in definitions:
        item = {k: deepcopy(v) for k, v in row.items() if k in allowed}
        group = row.get("browser_group")
        item["browser_group_name"] = group.get("name") if isinstance(group, dict) else id_names.get(group)
        # Runtime sample acceptance belongs to its environment, not the portable configuration.
        metadata = item.get("metadata", {})
        item["metadata"] = {
            "content_profile": metadata.get("content_profile", metadata.get("contentProfile", {"id": profile.PROFILE, "version": 1}))
        }
        if metadata.get("browser"):
            browser = metadata["browser"]
            item["metadata"]["browser"] = {
                "search_fields": browser.get("search_fields", browser.get("searchFields", [])),
                "filters": browser.get("filters", []),
            }
        portable.append(item)
    types = api.list("taxonomy/types/?namespace=" + str(ns["id"]))
    keys = set(profile.CLASSIFICATIONS)
    type_ids = {t["id"]: t["key"] for t in types if t["key"] in keys}
    terms = api.list("taxonomy/terms/?namespace=" + str(ns["id"]))
    by_id = {t["id"]: t for t in terms}
    core_parents = {t["slug"]: t["parent"] for t in profile.initial_bundle()["terms"]}
    core_terms = [
        t for t in terms if type_ids.get(t["classification_type"]) == "article_kind" and t["slug"] in core_parents
    ]
    if {t["slug"] for t in core_terms if t["status"] == "approved"} != set(core_parents):
        raise ValueError("definition_export=incomplete_core_terms")
    for term in core_terms:
        parent = by_id.get(term.get("parent"))
        if (parent["slug"] if parent else None) != core_parents[term["slug"]]:
            raise ValueError("definition_export=invalid_core_hierarchy")
    return {
        "format": "eceee-content-definitions",
        "version": 1,
        "profile": profile.PROFILE,
        "definitions": sorted(portable, key=lambda d: d["name"]),
        "classification_types": [
            {
                "key": t["key"],
                "name": t["name"],
                "description": t["description"],
                "object_types": [
                    id_names[int(use.split(":")[1])]
                    for use in t["allowed_uses"]
                    if use.startswith("object:") and int(use.split(":")[1]) in id_names
                ],
                "resource_uses": [use for use in t["allowed_uses"] if not use.startswith("object:")],
            }
            for t in types
            if t["key"] in keys
        ],
        "terms": [
            {
                "type": type_ids[t["classification_type"]],
                "slug": t["slug"],
                "name": t["name"],
                "parent": by_id[t["parent"]]["slug"] if t.get("parent") else None,
            }
            for t in core_terms
        ],
    }


def apply_bundle(api, ns, bundle, apply=False):
    if bundle.get("format") != "eceee-content-definitions" or bundle.get("version") != 1:
        raise ValueError("bundle=unsupported")
    if {d["name"] for d in bundle["definitions"]} != set(profile.OBJECT_TYPES):
        raise ValueError("bundle=wrong_object_types")
    if apply:
        reject_conflicting_terms(api, ns, bundle)
    current = {
        r["name"]: api.request(f'objects/object-types/{r["id"]}/')
        for r in api.list("objects/object-types/")
        if r["name"] in profile.OBJECT_TYPES
    }
    changes = []
    ids = {}
    # Definitions must be installed before remapping references and UI grouping.
    for item in bundle["definitions"]:
        name = item["name"]
        existing = current.get(name)
        if existing and existing.get("namespace", {}).get("id") != ns["id"]:
            raise ValueError(f"definition_namespace=conflict type={name}")
        desired = {k: deepcopy(v) for k, v in item.items() if k != "browser_group_name"}
        desired["namespace_id"] = ns["id"]
        if existing:
            desired["metadata"] = {**existing.get("metadata", {}), **desired.get("metadata", {})}
            # Browse choices edited in the target UI take precedence over import defaults.
            if "browser" in existing.get("metadata", {}):
                desired["metadata"]["browser"] = existing["metadata"]["browser"]
            different = [k for k, v in desired.items() if k != "namespace_id" and existing.get(k) != v]
        else:
            different = ["new"]
        if different:
            changes.append({"type": name, "fields": different})
            if apply:
                result = api.request(
                    f'objects/object-types/{existing["id"]}/' if existing else "objects/object-types/",
                    "PATCH" if existing else "POST",
                    desired,
                )
                existing = result
        if existing:
            ids[name] = existing["id"]
    current_names = {row["id"]: name for name, row in current.items()}
    for item in bundle["definitions"]:
        old = current.get(item["name"])
        group = old.get("browser_group") if old else None
        group_name = group.get("name") if isinstance(group, dict) else current_names.get(group)
        if group_name != item.get("browser_group_name"):
            changes.append({"type": item["name"], "fields": ["browser_group"]})
    existing_types = {t["key"]: t for t in api.list("taxonomy/types/?namespace=" + str(ns["id"]))}
    for item in bundle["classification_types"]:
        old = existing_types.get(item["key"])
        expected_objects = set(item["object_types"])
        actual_objects = (
            {current_names.get(int(use.split(":")[1])) for use in old["allowed_uses"] if use.startswith("object:")}
            if old
            else set()
        )
        actual_resources = {use for use in old["allowed_uses"] if not use.startswith("object:")} if old else set()
        if (
            not old
            or old["name"] != item["name"]
            or old.get("description", "") != item.get("description", "")
            or actual_objects != expected_objects
            or actual_resources != set(item.get("resource_uses", []))
        ):
            changes.append({"classificationType": item["key"], "fields": ["configuration"]})
    existing_terms = api.list("taxonomy/terms/?namespace=" + str(ns["id"]))
    term_ids = {t["id"]: t for t in existing_terms}
    term_map = {(t["tag_type"], t["slug"]): t for t in existing_terms}
    for term in bundle["terms"]:
        old = term_map.get((term["type"], term["slug"]))
        parent = term_ids.get(old.get("parent")) if old else None
        if (
            not old
            or old["name"] != term["name"]
            or old["status"] != "approved"
            or (parent["slug"] if parent else None) != term.get("parent")
            or (
                "alternative_names" in term
                and sorted(old.get("alternative_names") or []) != sorted(term["alternative_names"])
            )
        ):
            changes.append({"term": term["type"] + ":" + term["slug"], "fields": ["configuration"]})
    if not apply:
        return {"changes": changes, "bundleDigest": digest(bundle)}
    for item in bundle["definitions"]:
        group = item.get("browser_group_name")
        api.request(
            f'objects/object-types/{ids[item["name"]]}/', "PATCH", {"browser_group_id": ids[group] if group else None}
        )
    existing_types = {t["key"]: t for t in api.list("taxonomy/types/?namespace=" + str(ns["id"]))}
    for item in bundle["classification_types"]:
        uses = [f"object:{ids[name]}" for name in item["object_types"]] + item.get("resource_uses", [])
        desired = {
            "namespace": ns["id"],
            "key": item["key"],
            "name": item["name"],
            "description": item.get("description", ""),
            "allowed_uses": uses,
        }
        t = existing_types.get(item["key"])
        if not t:
            t = api.request("taxonomy/types/", "POST", desired)
        elif (
            t["allowed_uses"] != uses
            or t["name"] != desired["name"]
            or t.get("description", "") != desired["description"]
        ):
            t = api.request(
                f'taxonomy/types/{t["id"]}/configure/',
                "POST",
                {
                    "revision": t["revision"],
                    "name": desired["name"],
                    "description": desired["description"],
                    "allowed_uses": uses,
                },
            )
        existing_types[item["key"]] = t
    terms = api.list("taxonomy/terms/?namespace=" + str(ns["id"]))
    term_map = {(t["tag_type"], t["slug"]): t for t in terms}
    pending = list(bundle["terms"])
    while pending:
        progress = False
        for term in pending[:]:
            parent = term_map.get((term["type"], term["parent"])) if term.get("parent") else None
            if term.get("parent") and not parent:
                continue
            old = term_map.get((term["type"], term["slug"]))
            if old:
                if (
                    old["name"] != term["name"]
                    or old.get("parent") != (parent["id"] if parent else None)
                    or old["status"] != "approved"
                    or (
                        "alternative_names" in term
                        and sorted(old.get("alternative_names") or []) != sorted(term["alternative_names"])
                    )
                ):
                    raise ValueError("bundle_term=conflict")
            else:
                old = api.request(
                    "taxonomy/terms/",
                    "POST",
                    {
                        "classification_type": existing_types[term["type"]]["id"],
                        "payload": {
                            "name": term["name"],
                            "slug": term["slug"],
                            "parent_id": parent["id"] if parent else None,
                            "alternative_names": term.get("alternative_names", []),
                        },
                    },
                )["term"]
            term_map[(term["type"], term["slug"])] = old
            pending.remove(term)
            progress = True
        if not progress:
            raise ValueError("bundle_terms=missing_parent_or_cycle")
    return {
        "changes": changes,
        "objectTypeIds": ids,
        "classificationTypes": len(existing_types),
        "bundleDigest": digest(bundle),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["initial", "export", "diff", "apply"])
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env.local")
    parser.add_argument("--profile", choices=["dev", "production"], default="dev")
    parser.add_argument("--tenant")
    parser.add_argument("--namespace", default="default")
    parser.add_argument("--bundle", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--confirm-digest", help="Apply only this reviewed portable bundle digest; production gate remains separate"
    )
    args = parser.parse_args()
    try:
        if args.operation == "initial":
            if not args.output:
                raise ValueError("initial=output_required")
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(profile.initial_bundle(), indent=2, ensure_ascii=False) + "\n")
            print("initial_bundle=written")
            return
        api = Api(args.env_file, args.profile, args.tenant)
        if args.operation == "apply":
            if not args.bundle:
                raise ValueError("bundle=required")
            reviewed = json.loads(args.bundle.read_text())
            if args.confirm_digest != digest(reviewed):
                raise ValueError("bundle_digest=confirmation_required")
        ns = namespace(api, args.namespace, apply=args.operation == "apply")
        if args.operation == "export":
            if not ns or not args.output:
                raise ValueError("export=namespace_and_output_required")
            bundle = export_bundle(api, ns)
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(bundle, indent=2, ensure_ascii=False) + "\n")
            print(json.dumps({"export": "written", "bundleDigest": digest(bundle)}))
            return
        if not args.bundle:
            raise ValueError("bundle=required")
        bundle = json.loads(args.bundle.read_text())
        if args.operation == "apply" and args.confirm_digest != digest(bundle):
            raise ValueError("bundle_digest=confirmation_required")
        if ns is None:
            print(json.dumps({"namespace": "missing", "bundleDigest": digest(bundle)}))
            return
        print(json.dumps(apply_bundle(api, ns, bundle, apply=args.operation == "apply")))
    except (ValueError, OSError, urllib.error.URLError) as error:
        print(str(error) if isinstance(error, ValueError) else "definition_operation=failed", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
