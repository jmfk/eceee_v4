"""Capture static public pages with a bounded, address-pinned resource loader."""

import asyncio
import http.client
import ipaddress
import socket
from urllib.parse import quote, urljoin, urlsplit, urlunsplit

from playwright.async_api import async_playwright

MAX_RESOURCE = 4 * 1024 * 1024
MAX_TOTAL = 18 * 1024 * 1024
REDIRECT_STATUSES = {301, 302, 303, 307, 308}


def public_url(value):
    if not isinstance(value, str) or not value or len(value) > 2000:
        raise ValueError("Enter a public HTTP(S) URL.")
    if any(ord(char) <= 32 for char in value) or "\\" in value:
        raise ValueError("Invalid URL.")
    url = urlsplit(value)
    if (
        url.scheme not in {"http", "https"}
        or not url.hostname
        or url.username is not None
        or url.password is not None
        or url.port not in {None, 443 if url.scheme == "https" else 80}
        or "%" in url.hostname
        or "." not in url.hostname.rstrip(".")
    ):
        raise ValueError("Enter a public HTTP(S) URL.")
    return url


def request_public(value):
    url = public_url(value)
    host = url.hostname.encode("idna").decode("ascii")
    port = 443 if url.scheme == "https" else 80
    addresses = socket.getaddrinfo(host, port, family=socket.AF_INET, type=socket.SOCK_STREAM)
    ips = [ipaddress.ip_address(result[4][0]) for result in addresses]
    if not ips or any(
        not ip.is_global or ip.is_multicast or ip.is_reserved or getattr(ip, "ipv4_mapped", None) for ip in ips
    ):
        raise ValueError("Only public network addresses are allowed.")
    connection_type = http.client.HTTPSConnection if url.scheme == "https" else http.client.HTTPConnection
    connection = connection_type(host, port=port, timeout=5)
    # Keep HTTP Host, TLS verification and SNI set to the original hostname.
    # Connect directly to a validated address without a second hostname lookup.
    connection._create_connection = lambda _address, timeout, source_address: socket.create_connection(
        (str(ips[0]), port), timeout, source_address
    )
    try:
        path = quote(url.path or "/", safe="/%:@!$&'()*+,;=-._~")
        query = quote(url.query, safe="/?%:@!$&'()*+,;=-._~")
        target = urlunsplit(("", "", path, query, ""))
        connection.request("GET", target, headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
        result = connection.getresponse()
        if result.status in REDIRECT_STATUSES:
            location = result.getheader("Location")
            if not location:
                raise ValueError("Redirect has no destination.")
            target = urljoin(value, location)
            public_url(target)
            return result.status, {"location": target}, b""
        if result.getheader("Content-Encoding", "identity").lower() != "identity":
            raise ValueError("Resource encoding is not supported.")
        data = result.read(MAX_RESOURCE + 1)
        if len(data) > MAX_RESOURCE:
            raise ValueError("Resource is too large.")
        return result.status, {"content-type": result.getheader("Content-Type", "application/octet-stream")}, data
    finally:
        connection.close()


def follow_public_redirects(url):
    for _ in range(6):
        status, headers, body = request_public(url)
        if status not in REDIRECT_STATUSES:
            return url, status, headers, body
        url = headers["location"]
    raise ValueError("Too many redirects.")


async def capture_public_page(url):
    destination, document_status, document_headers, document = await asyncio.to_thread(follow_public_redirects, url)
    if not 200 <= document_status < 300 or "text/html" not in document_headers["content-type"].lower():
        raise ValueError("The public page did not return readable HTML.")
    remaining_bytes = MAX_TOTAL - len(document)
    requests_left = 100
    document_pending = True
    concurrency = asyncio.Semaphore(8)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            chromium_sandbox=True,
            args=["--disable-dev-shm-usage", "--proxy-server=http://127.0.0.1:1", "--proxy-bypass-list=<-loopback>"],
        )
        try:
            context = await browser.new_context(
                viewport={"width": 1440, "height": 900},
                java_script_enabled=False,
                service_workers="block",
                accept_downloads=False,
            )

            async def handle(route):
                nonlocal remaining_bytes, requests_left, document_pending
                if requests_left < 1 or remaining_bytes <= 0 or route.request.method != "GET":
                    await route.abort()
                    return
                requests_left -= 1
                try:
                    if route.request.is_navigation_request() and route.request.frame == page.main_frame:
                        if not document_pending:
                            await route.abort()
                            return
                        document_pending = False
                        await route.fulfill(status=document_status, headers=document_headers, body=document)
                        return
                    async with concurrency:
                        _, status, headers, data = await asyncio.to_thread(follow_public_redirects, route.request.url)
                    remaining_bytes -= len(data)
                    if remaining_bytes < 0:
                        await route.abort()
                        return
                except (OSError, ValueError, http.client.HTTPException):
                    await route.abort()
                    return
                await route.fulfill(status=status, headers=headers, body=data)

            await context.route("**/*", handle)
            page = await context.new_page()
            result = await page.goto(destination, wait_until="load", timeout=17000)
            if result is None or not result.ok or "text/html" not in result.headers.get("content-type", "").lower():
                raise ValueError("The public page did not return readable HTML.")
            return await page.screenshot(type="png", timeout=5000)
        finally:
            await browser.close()


if __name__ == "__main__":
    import sys

    destination = sys.stdin.buffer.read(8192).decode("utf-8")
    sys.stdout.buffer.write(asyncio.run(capture_public_page(destination)))
