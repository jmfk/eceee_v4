#!/usr/bin/env python3
"""Call supported ECEEE CMS API routes without exposing machine credentials."""

import argparse
from io import BytesIO
import mimetypes
import json
from pathlib import Path
import secrets
import stat
import sys
import urllib.error
import urllib.parse
import urllib.request


DEFAULT_SECRET_NAME = "ECEEE_API_KEY"
DEFAULT_BASE_URL = "http://localhost:10101/api/v1/"
DEFAULT_TENANT = "default"
ALLOWED_PREFIXES = ("webpages/", "content/", "taxonomy/", "media/", "objects/", "utils/value-lists/")
DENIED_PREFIXES = (
    "auth/",
    "core/machine-api-keys/",
    "data-connections/",
    "utils/change-password/",
    "utils/current-workspace/",
    "utils/users/",
    "webpages/designer/remote-connections/",
    "webpages/remote-sites/access-keys/",
)


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Refuse redirects so the machine Authorization header cannot change origin."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def read_env_file(env_file: Path) -> dict[str, str]:
    try:
        mode = stat.S_IMODE(env_file.stat().st_mode)
    except FileNotFoundError as exc:
        raise ValueError("env_file=missing") from exc
    if mode & 0o077:
        raise ValueError("env_file=mode_unsafe")

    values = {}
    with env_file.open(encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[7:].lstrip()
            name, separator, value = line.partition("=")
            if not separator:
                continue
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                value = value[1:-1]
            values[name.strip()] = value
    return values


def build_url(base_url: str, endpoint: str) -> str:
    endpoint = endpoint.lstrip("/")
    if endpoint.startswith("api/v1/"):
        endpoint = endpoint[7:]
    parsed = urllib.parse.urlsplit(endpoint)
    if parsed.scheme or parsed.netloc or ".." in parsed.path.split("/"):
        raise ValueError("endpoint=invalid")
    if any(parsed.path.startswith(prefix) for prefix in DENIED_PREFIXES):
        raise ValueError("endpoint=machine_denied")
    if not any(parsed.path.startswith(prefix) for prefix in ALLOWED_PREFIXES):
        raise ValueError("endpoint=outside_supported_cms_api")
    return urllib.parse.urljoin(base_url.rstrip("/") + "/", endpoint)



def resolve_profile(values, profile="dev", *, base_url=None, tenant=None, key_variable=None):
    """Keep production credentials separate and refuse accidental cross-origin use."""
    if profile == "dev":
        selected_base = base_url or values.get("ECEEE_API_BASE_URL", DEFAULT_BASE_URL)
        selected_tenant = tenant or values.get("ECEEE_API_TENANT", DEFAULT_TENANT)
        selected_key = DEFAULT_SECRET_NAME
        parsed = urllib.parse.urlsplit(selected_base)
        valid_origin = parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    else:
        selected_base = base_url or "https://app.eceee.org/api/v1/"
        selected_tenant = tenant or values.get("ECEEE_PROD_API_TENANT", "default")
        selected_key = "ECEEE_PROD_API_KEY" if profile == "production" else "ECEEE_PROD_THEME_API_KEY"
        parsed = urllib.parse.urlsplit(selected_base)
        valid_origin = selected_base == "https://app.eceee.org/api/v1/"
    if (
        not valid_origin or parsed.username or parsed.password or parsed.query or parsed.fragment
        or parsed.path != "/api/v1/"
    ):
        raise ValueError("profile=origin_mismatch")
    if key_variable and key_variable != selected_key:
        raise ValueError("profile=credential_mismatch")
    if not selected_tenant:
        raise ValueError("profile=tenant_missing")
    return selected_base, selected_tenant, selected_key


def validate_profile_endpoint(profile, endpoint):
    if profile == "production-themes":
        path = urllib.parse.urlsplit(endpoint.lstrip("/")).path.removeprefix("api/v1/")
        if not path.startswith(("webpages/themes/", "webpages/designer/themes/", "webpages/designer/theme-exports/")):
            raise ValueError("profile=theme_only")


def parse_form_values(raw_values: list[str]) -> list[tuple[str, str]]:
    values = []
    for raw_value in raw_values:
        name, separator, value = raw_value.partition("=")
        if not separator or not name:
            raise ValueError("form=invalid")
        values.append((name, value))
    return values


def encode_multipart(upload_file: Path, file_field: str, form_values: list[tuple[str, str]]):
    boundary = f"eceee-{secrets.token_hex(16)}"
    body = BytesIO()

    def write(value: str | bytes):
        body.write(value.encode() if isinstance(value, str) else value)

    for name, value in form_values:
        write(f"--{boundary}\r\n")
        write(f'Content-Disposition: form-data; name="{name}"\r\n\r\n')
        write(value)
        write("\r\n")

    content_type = mimetypes.guess_type(upload_file.name)[0] or "application/octet-stream"
    write(f"--{boundary}\r\n")
    write(f'Content-Disposition: form-data; name="{file_field}"; filename="{upload_file.name}"\r\n')
    write(f"Content-Type: {content_type}\r\n\r\n")
    write(upload_file.read_bytes())
    write(f"\r\n--{boundary}--\r\n")
    return body.getvalue(), f"multipart/form-data; boundary={boundary}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("endpoint", nargs="?", help="Endpoint below /api/v1/, optionally with a query string")
    parser.add_argument("--method", choices=("GET", "POST", "PUT", "PATCH", "DELETE"), default="GET")
    parser.add_argument("--data-file", type=Path, help="Request body file")
    parser.add_argument("--content-type", default="application/json")
    parser.add_argument("--upload-file", type=Path, help="Encode one file as multipart form data")
    parser.add_argument("--file-field", default="file")
    parser.add_argument("--form", action="append", default=[], metavar="NAME=VALUE")
    parser.add_argument("--output", type=Path, help="Write the response body to a file")
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--key-variable", help="Compatibility option; must match the selected profile")
    parser.add_argument("--profile", choices=("dev", "production", "production-themes"), default="dev")
    parser.add_argument("--check-profile", action="store_true", help="Check local configuration without a network request")
    parser.add_argument("--status-only", action="store_true", help="Report HTTP status without printing response content")
    parser.add_argument("--base-url")
    parser.add_argument("--tenant")
    args = parser.parse_args()

    if not args.endpoint and not args.check_profile:
        parser.error("endpoint is required unless --check-profile is used")
    if args.data_file and args.upload_file:
        parser.error("--data-file and --upload-file cannot be combined")
    if args.method in {"POST", "PUT", "PATCH"} and not (args.data_file or args.upload_file):
        parser.error("mutating methods require --data-file or --upload-file")
    if args.upload_file and args.method not in {"POST", "PUT", "PATCH"}:
        parser.error("--upload-file requires POST, PUT, or PATCH")

    try:
        values = read_env_file(args.env_file)
        base_url, tenant, key_name = resolve_profile(
            values, args.profile, base_url=args.base_url, tenant=args.tenant, key_variable=args.key_variable
        )
        secret = values.get(key_name)
        if args.check_profile:
            print(json.dumps({"profile": args.profile, "baseUrl": base_url, "tenant": tenant,
                              "credential": "present" if secret else "missing"}))
            return 0 if secret else 2
        if not secret:
            raise ValueError("credential=missing")
        validate_profile_endpoint(args.profile, args.endpoint)
        url = build_url(base_url, args.endpoint)
        body = None
        content_type = args.content_type
        if args.upload_file:
            body, content_type = encode_multipart(args.upload_file, args.file_field, parse_form_values(args.form))
        elif args.data_file:
            body = args.data_file.read_bytes()

        headers = {
            "Accept": "application/json",
            "Authorization": f"ApiKey {secret}",
            "X-Tenant-ID": tenant,
        }
        if body is not None:
            headers["Content-Type"] = content_type
        request = urllib.request.Request(url, data=body, headers=headers, method=args.method)
        opener = urllib.request.build_opener(NoRedirectHandler())
        with opener.open(request, timeout=30) as response:
            response_body = response.read()
            status_code = response.status
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    except urllib.error.HTTPError as exc:
        print(f"request=failed status={exc.code}", file=sys.stderr)
        return 1
    except (OSError, urllib.error.URLError):
        print("request=failed", file=sys.stderr)
        return 1

    if args.output:
        args.output.write_bytes(response_body)
    elif not args.status_only:
        sys.stdout.buffer.write(response_body)
        if response_body and not response_body.endswith(b"\n"):
            sys.stdout.buffer.write(b"\n")
    print(f"request=ok status={status_code}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
