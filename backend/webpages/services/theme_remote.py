"""Request-scoped access to another ECEEE installation's theme-sync API."""

import ipaddress
import socket
from urllib.parse import urljoin, urlparse

import requests
from django.conf import settings


class RemoteThemeError(Exception):
    pass


def validate_remote_url(value):
    value = value.strip().rstrip("/") + "/"
    parsed = urlparse(value)
    if parsed.scheme not in ({"http", "https"} if settings.DEBUG else {"https"}) or not parsed.hostname:
        raise RemoteThemeError("Enter a valid remote site URL using HTTPS.")
    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(parsed.hostname, parsed.port or 443)}
    except socket.gaierror as exc:
        raise RemoteThemeError("The remote site could not be resolved.") from exc
    if not settings.DEBUG:
        for address in addresses:
            ip = ipaddress.ip_address(address)
            if not ip.is_global:
                raise RemoteThemeError("Private or local remote addresses are not allowed.")
    return value


def remote_sync_request(remote_url, workspace, token, action, payload=None):
    base = validate_remote_url(remote_url)
    url = urljoin(base, f"api/v1/webpages/themes/sync/{action}/")
    try:
        response = requests.post(
            url,
            json=payload or {},
            headers={"Authorization": f"ThemeKey {token}", "X-Tenant-ID": workspace, "Accept": "application/json"},
            timeout=(5, 30),
            allow_redirects=False,
        )
    except requests.RequestException as exc:
        raise RemoteThemeError("The remote site could not be reached.") from exc
    if 300 <= response.status_code < 400:
        raise RemoteThemeError("The remote site redirected the request. Configure its final URL instead.")
    if response.status_code >= 400:
        message = "The remote site rejected the request."
        if response.status_code in {401, 403}:
            message = "The remote credentials or workspace were not accepted."
        elif response.status_code == 409:
            message = "The remote theme has changed. Refresh the remote list and try again."
        raise RemoteThemeError(message)
    try:
        return response.json()
    except ValueError as exc:
        raise RemoteThemeError("The remote site returned an invalid response.") from exc
