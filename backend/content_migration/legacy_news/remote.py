"""Network safety helpers shared by the legacy News importers."""

from __future__ import annotations

import http.client
import ipaddress
import socket
import ssl
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit

from .fetcher import USER_AGENT


def _ascii_hostname(hostname: str, *, subject: str) -> str:
    try:
        return hostname.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise ValueError(f"unsupported-{subject}-host") from exc


def validate_public_http_url(url: str, *, subject: str) -> tuple[str, ...]:
    """Reject non-HTTP and non-public destinations before an outbound request."""

    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError(f"unsupported-{subject}-url")
    hostname = _ascii_hostname(parsed.hostname, subject=subject)
    try:
        addresses = {
            ipaddress.ip_address(item[4][0])
            for item in socket.getaddrinfo(
                hostname,
                parsed.port or (443 if parsed.scheme == "https" else 80),
                type=socket.SOCK_STREAM,
            )
        }
    except (socket.gaierror, ValueError) as exc:
        raise ValueError(f"unresolvable-{subject}-host") from exc
    if not addresses or any(
        not address.is_global or getattr(address, "is_site_local", False) or address.is_multicast
        for address in addresses
    ):
        raise ValueError(f"non-public-{subject}-host")
    return tuple(str(address) for address in sorted(addresses, key=lambda item: (item.version, str(item))))


@dataclass(frozen=True)
class HeadResponse:
    status_code: int
    headers: dict[str, str]


@dataclass(frozen=True)
class GetResponse:
    status_code: int
    headers: dict[str, str]
    content: bytes


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    """Connect to a validated IP while retaining hostname verification and SNI."""

    def __init__(self, address: str, *, hostname: str, port: int, timeout: float):
        super().__init__(address, port=port, timeout=timeout, context=ssl.create_default_context())
        self._verified_hostname = hostname

    def connect(self) -> None:
        self.sock = socket.create_connection(
            (self.host, self.port),
            self.timeout,
            self.source_address,
        )
        self.sock = self._context.wrap_socket(self.sock, server_hostname=self._verified_hostname)


def head_public_url(url: str, *, timeout: float = 10.0) -> HeadResponse:
    """HEAD a public URL through a DNS-pinned connection to prevent rebinding."""

    parsed = urlsplit(url)
    addresses = validate_public_http_url(url, subject="link")
    hostname = _ascii_hostname(parsed.hostname or "", subject="link")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    authority_host = f"[{hostname}]" if ":" in hostname else hostname
    authority = f"{authority_host}:{parsed.port}" if parsed.port else authority_host
    target = urlunsplit(("", "", parsed.path or "/", parsed.query, ""))
    last_error: Exception | None = None

    for address in addresses:
        connection = None
        try:
            if parsed.scheme == "https":
                connection = _PinnedHTTPSConnection(address, hostname=hostname, port=port, timeout=timeout)
            else:
                connection = http.client.HTTPConnection(address, port=port, timeout=timeout)
            connection.request("HEAD", target, headers={"Host": authority, "User-Agent": USER_AGENT})
            response = connection.getresponse()
            headers = {name.lower(): value for name, value in response.getheaders()}
            return HeadResponse(status_code=response.status, headers=headers)
        except (OSError, http.client.HTTPException, ssl.SSLError) as exc:
            last_error = exc
        finally:
            if connection is not None:
                connection.close()

    raise ValueError("unreachable-link-host") from last_error


def get_public_url(url: str, *, timeout: float = 20.0, max_bytes: int) -> GetResponse:
    """GET a public URL through a DNS-pinned connection with a bounded body."""

    parsed = urlsplit(url)
    addresses = validate_public_http_url(url, subject="image")
    hostname = _ascii_hostname(parsed.hostname or "", subject="image")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    authority_host = f"[{hostname}]" if ":" in hostname else hostname
    authority = f"{authority_host}:{parsed.port}" if parsed.port else authority_host
    target = urlunsplit(("", "", parsed.path or "/", parsed.query, ""))
    last_error: Exception | None = None

    for address in addresses:
        connection = None
        try:
            if parsed.scheme == "https":
                connection = _PinnedHTTPSConnection(address, hostname=hostname, port=port, timeout=timeout)
            else:
                connection = http.client.HTTPConnection(address, port=port, timeout=timeout)
            connection.request("GET", target, headers={"Host": authority, "User-Agent": USER_AGENT})
            response = connection.getresponse()
            headers = {name.lower(): value for name, value in response.getheaders()}
            content = response.read(max_bytes + 1) if 200 <= response.status < 300 else b""
            return GetResponse(status_code=response.status, headers=headers, content=content)
        except (OSError, http.client.HTTPException, ssl.SSLError) as exc:
            last_error = exc
        finally:
            if connection is not None:
                connection.close()

    raise ValueError("unreachable-image-host") from last_error


def get_public_json(url: str, *, authorization: str, timeout: float = 30.0, max_bytes: int) -> GetResponse:
    """GET bounded JSON over pinned HTTPS without forwarding credentials."""

    parsed = urlsplit(url)
    if parsed.scheme != "https":
        raise ValueError("unsupported-api-url")
    addresses = validate_public_http_url(url, subject="api")
    hostname = _ascii_hostname(parsed.hostname or "", subject="api")
    port = parsed.port or 443
    authority_host = f"[{hostname}]" if ":" in hostname else hostname
    authority = f"{authority_host}:{parsed.port}" if parsed.port else authority_host
    target = urlunsplit(("", "", parsed.path or "/", parsed.query, ""))
    last_error: Exception | None = None

    for address in addresses:
        connection = None
        try:
            connection = _PinnedHTTPSConnection(address, hostname=hostname, port=port, timeout=timeout)
            connection.request(
                "GET",
                target,
                headers={
                    "Host": authority,
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json",
                    "Authorization": authorization,
                },
            )
            response = connection.getresponse()
            headers = {name.lower(): value for name, value in response.getheaders()}
            content = response.read(max_bytes + 1)
            return GetResponse(status_code=response.status, headers=headers, content=content)
        except (OSError, http.client.HTTPException, ssl.SSLError) as exc:
            last_error = exc
        finally:
            if connection is not None:
                connection.close()

    raise ValueError("unreachable-api-host") from last_error
