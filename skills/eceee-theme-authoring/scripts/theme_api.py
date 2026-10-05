#!/usr/bin/env python3
"""Call ECEEE theme API routes without exposing the machine credential."""

import argparse
from pathlib import Path
import stat
import sys
import urllib.error
import urllib.parse
import urllib.request


SECRET_NAME = "ECEEE_PROD_THEME_API_KEY"
DEFAULT_BASE_URL = "https://app.eceee.org/api/v1/"
DEFAULT_TENANT = "default"
ALLOWED_PREFIXES = (
    "webpages/designer/themes/",
    "webpages/designer/theme-exports/",
    "webpages/themes/",
)


def read_secret(env_file: Path) -> str:
    try:
        mode = stat.S_IMODE(env_file.stat().st_mode)
    except FileNotFoundError as exc:
        raise ValueError("env_file=missing") from exc
    if mode & 0o077:
        raise ValueError("env_file=mode_unsafe")

    value = None
    with env_file.open(encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[7:].lstrip()
            name, separator, candidate = line.partition("=")
            if separator and name.strip() == SECRET_NAME:
                candidate = candidate.strip()
                if len(candidate) >= 2 and candidate[0] == candidate[-1] and candidate[0] in {"'", '"'}:
                    candidate = candidate[1:-1]
                value = candidate
    if not value:
        raise ValueError("credential=missing")
    return value


def build_url(base_url: str, endpoint: str) -> str:
    endpoint = endpoint.lstrip("/")
    if endpoint.startswith("api/v1/"):
        endpoint = endpoint[7:]
    parsed = urllib.parse.urlsplit(endpoint)
    if parsed.scheme or parsed.netloc or ".." in parsed.path.split("/"):
        raise ValueError("endpoint=invalid")
    if not any(parsed.path.startswith(prefix) for prefix in ALLOWED_PREFIXES):
        raise ValueError("endpoint=outside_theme_api")
    return urllib.parse.urljoin(base_url.rstrip("/") + "/", endpoint)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("endpoint", help="Theme endpoint below /api/v1/, optionally with a query string")
    parser.add_argument("--method", choices=("GET", "POST", "PUT", "PATCH", "DELETE"), default="GET")
    parser.add_argument("--data-file", type=Path, help="JSON request body; required for mutating methods")
    parser.add_argument("--output", type=Path, help="Write the response body to this file instead of stdout")
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--tenant", default=DEFAULT_TENANT)
    args = parser.parse_args()

    if args.method != "GET" and args.data_file is None:
        parser.error("--data-file is required for mutating methods")

    try:
        secret = read_secret(args.env_file)
        url = build_url(args.base_url, args.endpoint)
        body = args.data_file.read_bytes() if args.data_file else None
        headers = {
            "Accept": "application/json",
            "Authorization": f"ApiKey {secret}",
            "X-Tenant-ID": args.tenant,
        }
        if body is not None:
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(url, data=body, headers=headers, method=args.method)
        with urllib.request.urlopen(request, timeout=30) as response:
            response_body = response.read()
            status_code = response.status
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    except (OSError, urllib.error.URLError):
        print("request=failed", file=sys.stderr)
        return 1

    if args.output:
        args.output.write_bytes(response_body)
    else:
        sys.stdout.buffer.write(response_body)
        if response_body and not response_body.endswith(b"\n"):
            sys.stdout.buffer.write(b"\n")
    print(f"request=ok status={status_code}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
