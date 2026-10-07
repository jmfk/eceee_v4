"""Request-scoped access to another ECEEE installation's theme-sync API."""

import ipaddress
import socket
from urllib.parse import urljoin, urlparse

import requests
from django.conf import settings


class RemoteThemeError(Exception):
    pass


class RemoteTransportError(RemoteThemeError):
    """A retryable failure while communicating with a remote installation."""


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


def remote_sync_request(remote_url, workspace, token, action, payload=None, auth_scheme="ThemeKey"):
    base = validate_remote_url(remote_url)
    url = urljoin(base, f"api/v1/webpages/themes/sync/{action}/")
    try:
        response = requests.post(
            url,
            json=payload or {},
            headers={"Authorization": f"{auth_scheme} {token}", "X-Tenant-ID": workspace, "Accept": "application/json"},
            timeout=(5, 30),
            allow_redirects=False,
        )
    except requests.RequestException as exc:
        raise RemoteTransportError("The remote site could not be reached.") from exc
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


def remote_site_request(connection, method, path, payload=None, stream=False):
    """Call a bounded site-transfer endpoint on a saved remote connection."""
    from webpages.services.theme_remote_credentials import decrypt_access_key

    base = validate_remote_url(connection.base_url)
    url = urljoin(base, f"api/v1/webpages/site-packages/remote-source/{path.lstrip('/')}")
    token = decrypt_access_key(connection.encrypted_access_key)
    try:
        response = requests.request(
            method,
            url,
            json=payload if payload is not None else None,
            headers={
                "Authorization": f"{'ApiKey' if connection.credential_scheme == 'api_key' else 'ThemeKey'} {token}",
                "X-Tenant-ID": connection.remote_workspace,
                "Accept": "application/zip" if stream else "application/json",
            },
            timeout=(5, 60),
            allow_redirects=False,
            stream=stream,
        )
    except requests.RequestException as exc:
        raise RemoteTransportError("The remote site could not be reached.") from exc
    if 300 <= response.status_code < 400:
        response.close()
        raise RemoteThemeError("The remote site redirected the request. Configure its final URL instead.")
    if response.status_code >= 400:
        response.close()
        message = "The remote site rejected the request."
        if response.status_code in {401, 403}:
            message = "The remote credentials do not include site transfer access."
        elif response.status_code == 404:
            message = "The remote site or export could not be found."
        raise RemoteThemeError(message)
    if stream:
        return response
    try:
        return response.json()
    except ValueError as exc:
        raise RemoteThemeError("The remote site returned an invalid response.") from exc
    finally:
        response.close()


def remote_object_request(connection, method, path, payload=None, stream=False):
    """Call object-transfer endpoints using a saved general machine API key."""
    from webpages.services.theme_remote_credentials import decrypt_access_key

    if connection.credential_scheme != "api_key":
        raise RemoteThemeError("Object transfer requires a saved machine API key.")
    base = validate_remote_url(connection.base_url)
    url = urljoin(base, f"api/v1/objects/remote-source/{path.lstrip('/')}")
    token = decrypt_access_key(connection.encrypted_access_key)
    try:
        response = requests.request(
            method,
            url,
            json=payload if payload is not None else None,
            headers={
                "Authorization": f"ApiKey {token}",
                "X-Tenant-ID": connection.remote_workspace,
                "Accept": "application/zip" if stream else "application/json",
            },
            timeout=(5, 60),
            allow_redirects=False,
            stream=stream,
        )
    except requests.RequestException as exc:
        raise RemoteTransportError("The remote site could not be reached.") from exc
    if 300 <= response.status_code < 400:
        response.close()
        raise RemoteThemeError("The remote site redirected the request. Configure its final URL instead.")
    if response.status_code >= 400:
        response.close()
        if response.status_code in {401, 403}:
            raise RemoteThemeError("The remote credentials do not include object transfer access.")
        raise RemoteThemeError("The remote object transfer request failed.")
    if stream:
        return response
    try:
        return response.json()
    except ValueError as exc:
        raise RemoteThemeError("The remote site returned an invalid response.") from exc
    finally:
        response.close()
