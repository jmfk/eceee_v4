"""Reference adapter for portable pilot cases. No snapshot is updated by a test run."""

import copy
import hashlib
import json
import re
from pathlib import Path

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "pilot_baseline"


def comparable_observations(observed):
    """Ignore only the minor version in Pydantic 2 error documentation links."""
    result = copy.deepcopy(observed)
    if not isinstance(result, dict):
        return result
    for observation in result.values():
        body = observation.get("body") if isinstance(observation, dict) else None
        errors = body.get("rawErrors") if isinstance(body, dict) else None
        if not isinstance(errors, list):
            continue
        for error in errors:
            if isinstance(error, dict) and isinstance(error.get("url"), str):
                error["url"] = re.sub(
                    r"\Ahttps://errors\.pydantic\.dev/2\.\d+/v/([a-z_]+)\Z",
                    r"https://errors.pydantic.dev/2.x/v/\1",
                    error["url"],
                )
    return result


def load_cases():
    return json.loads((FIXTURE_DIR / "cases.json").read_text())


def fixture_digest():
    return hashlib.sha256((FIXTURE_DIR / "cases.json").read_bytes()).hexdigest()


def observe_case(case):
    # Use the real router, parser, permissions and renderer, without a web server.
    # Middleware/session and persisted page behavior are covered separately.
    from django.contrib.auth.models import AnonymousUser, User
    from django.urls import resolve
    from rest_framework.test import APIRequestFactory, force_authenticate

    factory = APIRequestFactory()
    method = case["method"].lower()
    request = getattr(factory, method)(case["path"], case.get("body"), format="json")
    user = AnonymousUser() if case.get("anonymous") else User(username="pilot-reference")
    force_authenticate(request, user=user)
    match = resolve(case["path"].split("?", 1)[0])
    response = match.func(request, *match.args, **match.kwargs)
    response.render()
    return {"status": response.status_code, "body": json.loads(response.content)}


def observations():
    from webpages.publisher_manifest import build_publisher_manifest

    manifest = build_publisher_manifest()
    encoded = json.dumps(manifest, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    result = {case["id"]: observe_case(case) for case in load_cases()["contracts"]}
    result["render-manifest"] = {
        "formatVersion": manifest["formatVersion"],
        "types": sorted(manifest["widgets"]),
        "sha256": hashlib.sha256(encoded).hexdigest(),
    }
    return {"formatVersion": 1, "casesSha256": fixture_digest(), "observations": result}


if __name__ == "__main__":
    import argparse

    import django

    parser = argparse.ArgumentParser(description="Observe the current Django adapter; does not update the reference")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    django.setup()
    args.output.write_text(json.dumps(observations(), indent=2, sort_keys=True, ensure_ascii=False) + "\n")
