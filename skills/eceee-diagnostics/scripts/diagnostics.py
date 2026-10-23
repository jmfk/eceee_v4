#!/usr/bin/env python3
"""Bounded ECEEE diagnostic requests. Secrets never enter command arguments or output."""

import argparse
import json
import os
import re
import stat
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ORIGINS = {
    "dev": "http://localhost:10101/api/v1/diagnostics/",
    "production": "https://app.eceee.org/api/v1/diagnostics/",
}
VARIABLES = {"dev": "ECEEE_DIAGNOSTICS_DEV_API_KEY", "production": "ECEEE_DIAGNOSTICS_PROD_API_KEY"}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def credential(path, variable):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, "r", encoding="utf-8") as handle:
        mode = os.fstat(handle.fileno()).st_mode
        if not stat.S_ISREG(mode) or stat.S_IMODE(mode) != 0o600:
            raise ValueError("credential_file=mode_unsafe")
        value = None
        for line in handle:
            name, separator, candidate = line.strip().partition("=")
            if name == variable and separator:
                if value is not None:
                    raise ValueError("credential=duplicate")
                value = candidate.strip().strip("\"'")
        if not value or not value.startswith("mapi_") or any(c.isspace() for c in value):
            raise ValueError("credential=missing_or_invalid")
        return value


def perform(profile, secret, endpoint, body=None):
    # Endpoints are selected by the command router, never arbitrary URLs or user paths.
    url = ORIGINS[profile] + endpoint
    parsed = urllib.parse.urlsplit(url)
    if (
        endpoint not in {"sources/", "data/catalog/", "logs/search/", "data/query/"}
        and not re.fullmatch(
            r"logs/events/[0-9]{8}T[0-9]{12}-[a-f0-9]{32}\.[a-f0-9]{64}/\?tenants=[A-Za-z0-9_%.-]+&include_global=(?:true|false)",
            endpoint,
        )
    ) or parsed.fragment:
        raise ValueError("endpoint=invalid")
    encoded = json.dumps(body).encode() if body is not None else None
    if encoded is not None and len(encoded) > 16384:
        raise ValueError("request=too_large")
    request = urllib.request.Request(
        url,
        data=encoded,
        headers={"Authorization": "ApiKey " + secret, "Content-Type": "application/json", "Accept": "application/json"},
    )
    opener = urllib.request.build_opener(NoRedirect())
    with opener.open(request, timeout=15) as response:
        raw = response.read(1024 * 1024 + 1)
        if len(raw) > 1024 * 1024:
            raise ValueError("response=too_large")
        return json.loads(raw)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=ORIGINS, default="dev")
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("sources")
    commands.add_parser("catalog")
    for command in ("logs", "query"):
        sub = commands.add_parser(command)
        sub.add_argument(
            "--data-file",
            required=True,
            type=Path,
            help="JSON search/query including explicit tenants; cursor is optional",
        )
    event = commands.add_parser("event")
    event.add_argument("id")
    event.add_argument("--tenant", required=True, help="Tenant UUID or all_allowed")
    event.add_argument("--include-global", action="store_true")
    args = parser.parse_args()
    try:
        secret = credential(args.env_file, VARIABLES[args.profile])
        body = None
        if args.command in {"sources", "catalog"}:
            endpoint = "sources/" if args.command == "sources" else "data/catalog/"
        elif args.command == "event":
            import re

            if not re.fullmatch(r"[0-9]{8}T[0-9]{12}-[a-f0-9]{32}\.[a-f0-9]{64}", args.id):
                raise ValueError("event_id=invalid")
            endpoint = (
                "logs/events/"
                + args.id
                + "/?"
                + urllib.parse.urlencode({"tenants": args.tenant, "include_global": str(args.include_global).lower()})
            )
        else:
            if args.data_file.stat().st_size > 16384:
                raise ValueError("request=too_large")
            body = json.loads(args.data_file.read_text())
            endpoint = "logs/search/" if args.command == "logs" else "data/query/"
        result = perform(args.profile, secret, endpoint, body)
        print(json.dumps(result, ensure_ascii=True, indent=2))
        return 0
    except urllib.error.HTTPError as exc:
        print(f"diagnostics=http_{exc.code}", file=sys.stderr)
        exc.close()
    except Exception:
        print("diagnostics=request_failed", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
