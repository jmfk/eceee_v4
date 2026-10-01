"""
Preview-related views for page editor
"""

import json
import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.views.decorators.clickjacking import xframe_options_exempt
from rest_framework import permissions, status, viewsets
from rest_framework.authentication import BaseAuthentication, SessionAuthentication, TokenAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from ..models import PageVersion, PreviewSize, WebPage
from ..renderers import WebPageRenderer
from ..serializers import PreviewSizeSerializer

PREVIEW_GRANT_SALT = "webpages.version-preview"
PREVIEW_GRANT_MAX_AGE_SECONDS = 60
PREVIEW_NAVIGATION_GRANT_SALT = "webpages.version-preview-navigation"
PREVIEW_NAVIGATION_GRANT_MAX_AGE_SECONDS = 15 * 60


class PreviewGrantAuthentication(BaseAuthentication):
    """Authenticate a short-lived grant scoped to one page-version preview."""

    def authenticate_header(self, request):
        return "PreviewGrant"

    def authenticate(self, request):
        token = request.query_params.get("preview_token")
        if token is None:
            return None

        try:
            payload = signing.loads(token, salt=PREVIEW_GRANT_SALT, max_age=PREVIEW_GRANT_MAX_AGE_SECONDS)
        except signing.SignatureExpired as error:
            raise AuthenticationFailed("Preview grant has expired.") from error
        except signing.BadSignature as error:
            raise AuthenticationFailed("Invalid preview grant.") from error

        route = request.resolver_match.kwargs
        if str(payload.get("page_id")) != str(route.get("page_id")) or str(payload.get("version_id")) != str(
            route.get("version_id")
        ):
            raise AuthenticationFailed("Preview grant does not match this page version.")

        user = get_user_model().objects.filter(pk=payload.get("user_id"), is_active=True).first()
        if not user:
            raise AuthenticationFailed("Preview user is unavailable.")
        return user, token


class PreviewNavigationGrantAuthentication(BaseAuthentication):
    """Authenticate a read-only navigation grant for one rendered preview."""

    def authenticate_header(self, request):
        return "PreviewNavigationGrant"

    def authenticate(self, request):
        token = request.headers.get("X-Preview-Navigation-Grant")
        if token is None:
            return None

        try:
            payload = signing.loads(
                token,
                salt=PREVIEW_NAVIGATION_GRANT_SALT,
                max_age=PREVIEW_NAVIGATION_GRANT_MAX_AGE_SECONDS,
            )
        except signing.SignatureExpired as error:
            raise AuthenticationFailed("Preview navigation grant has expired.") from error
        except signing.BadSignature as error:
            raise AuthenticationFailed("Invalid preview navigation grant.") from error

        route = request.resolver_match.kwargs
        if str(payload.get("page_id")) != str(route.get("page_id")) or str(payload.get("version_id")) != str(
            route.get("version_id")
        ):
            raise AuthenticationFailed("Preview navigation grant does not match this page version.")

        user = get_user_model().objects.filter(pk=payload.get("user_id"), is_active=True).first()
        if not user:
            raise AuthenticationFailed("Preview user is unavailable.")
        return user, payload


class PreviewSizeViewSet(viewsets.ModelViewSet):
    """
    API viewset for managing preview size configurations.

    Allows authenticated users to create, read, update, and delete
    preview size configurations for the page editor.
    """

    queryset = PreviewSize.objects.all()
    serializer_class = PreviewSizeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return preview sizes ordered by sort_order"""
        return PreviewSize.objects.all().order_by("sort_order", "id")


PREVIEW_NAVIGATION_MENU_SCRIPT = r"""
        (function() {
            const MENU_ID = 'eceee-preview-nav-link-menu';
            let activeLink = null;

            function removeMenu() {
                const existing = document.getElementById(MENU_ID);
                if (existing) {
                    existing.remove();
                }
                activeLink = null;
            }

            function isHttpUrl(url) {
                return url.protocol === 'http:' || url.protocol === 'https:';
            }

            function isAnchorOnly(link) {
                const rawHref = link.getAttribute('href') || '';
                return rawHref.trim().startsWith('#');
            }

            function getUrl(link) {
                const href = link.getAttribute('href') || '';
                try {
                    return new URL(href, document.baseURI || window.location.href);
                } catch (error) {
                    return null;
                }
            }

            function isInternalUrl(url) {
                const internalOrigins = new Set([window.location.origin]);
                try {
                    internalOrigins.add(new URL(document.baseURI || window.location.href).origin);
                } catch (error) {
                    // Ignore invalid base URI and fall back to the preview origin.
                }
                return internalOrigins.has(url.origin);
            }

            function isNavigationLink(link) {
                return Boolean(link.closest(
                    'nav, .navigation-widget, .navbar-widget, .widget-type-navigation, .widget-type-navbar'
                ));
            }

            function openNewTab(url) {
                window.open(url, '_blank', 'noopener,noreferrer');
            }

            function openEditorHere(url) {
                try {
                    window.top.location.href = url;
                } catch (error) {
                    window.location.href = url;
                }
            }

            function createButton(label, options) {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = label;
                button.setAttribute('role', 'menuitem');
                button.disabled = Boolean(options.disabled);
                if (options.title) {
                    button.title = options.title;
                }
                button.addEventListener('click', function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (button.disabled) return;
                    options.onClick();
                    removeMenu();
                });
                return button;
            }

            function renderMenu(link, items, position) {
                removeMenu();
                activeLink = link;

                const menu = document.createElement('div');
                menu.id = MENU_ID;
                menu.setAttribute('role', 'menu');
                menu.style.top = `${position.top}px`;
                menu.style.left = `${position.left}px`;

                items.forEach(function(item) {
                    menu.appendChild(createButton(item.label, item));
                });

                document.body.appendChild(menu);
            }

            function renderLoadingMenu(link, position) {
                removeMenu();
                activeLink = link;

                const menu = document.createElement('div');
                menu.id = MENU_ID;
                menu.setAttribute('role', 'menu');
                menu.style.top = `${position.top}px`;
                menu.style.left = `${position.left}px`;

                const loading = document.createElement('div');
                loading.className = 'eceee-preview-nav-menu-loading';
                loading.textContent = 'Loading page actions...';
                menu.appendChild(loading);

                document.body.appendChild(menu);
            }

            async function resolveInternalPage(url) {
                const navigation = window.eceeePreviewNavigation;
                if (!navigation?.grant || !navigation?.endpoint) {
                    throw new Error('Preview navigation is unavailable');
                }

                const endpoint = new URL(navigation.endpoint, window.location.origin).toString();
                const response = await fetch(endpoint, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-Preview-Navigation-Grant': navigation.grant,
                    },
                    body: JSON.stringify({ path: url.pathname, hostname: url.hostname }),
                });
                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }
                const page = await response.json();

                return {
                    ...page,
                    publicUrl: `${url.pathname}${url.search}${url.hash}`,
                };
            }

            function menuPositionFromEvent(event, link) {
                const rect = link.getBoundingClientRect();
                return {
                    top: Math.round(rect.bottom + window.scrollY + 4),
                    left: Math.round(Math.max(8, Math.min(rect.left + window.scrollX, window.innerWidth - 260))),
                };
            }

            function showExternalMenu(link, url, event) {
                renderMenu(link, [{
                    label: 'Open in new tab',
                    disabled: false,
                    onClick: function() { openNewTab(url.href); },
                }], menuPositionFromEvent(event, link));
            }

            async function showInternalMenu(link, url, event) {
                const position = menuPositionFromEvent(event, link);
                renderLoadingMenu(link, position);

                let page;
                try {
                    page = await resolveInternalPage(url);
                } catch (error) {
                    renderMenu(link, [{
                        label: 'Open in new tab',
                        disabled: false,
                        onClick: function() { openNewTab(`${url.pathname}${url.search}${url.hash}`); },
                    }], position);
                    return;
                }
                if (!page.pageId) {
                    renderMenu(link, [{
                        label: 'Open in new tab',
                        disabled: false,
                        onClick: function() { openNewTab(`${url.pathname}${url.search}${url.hash}`); },
                    }], position);
                    return;
                }

                const editorUrl = new URL(`/pages/${page.pageId}/edit`, window.location.origin).toString();
                const previewUrl = page.previewUrl
                    ? new URL(page.previewUrl, window.location.origin).toString()
                    : '';

                renderMenu(link, [
                    {
                        label: 'Open public page in new tab',
                        disabled: !page.isPublished,
                        title: page.isPublished ? '' : 'This page does not have a published version',
                        onClick: function() { openNewTab(page.publicUrl); },
                    },
                    {
                        label: 'Open preview in new tab',
                        disabled: !previewUrl,
                        title: previewUrl ? '' : 'No page version is available to preview',
                        onClick: function() { openNewTab(previewUrl); },
                    },
                    {
                        label: 'Open editor here',
                        disabled: false,
                        onClick: function() { openEditorHere(editorUrl); },
                    },
                    {
                        label: 'Open editor in new tab',
                        disabled: false,
                        onClick: function() { openNewTab(editorUrl); },
                    },
                ], position);
            }

            document.addEventListener('click', function(event) {
                const link = event.target.closest ? event.target.closest('a') : null;
                if (!link) return;

                event.preventDefault();
                event.stopPropagation();

                if (!isNavigationLink(link) || isAnchorOnly(link)) {
                    removeMenu();
                    return false;
                }

                const url = getUrl(link);
                if (!url || !isHttpUrl(url)) {
                    removeMenu();
                    return false;
                }

                if (!isInternalUrl(url)) {
                    showExternalMenu(link, url, event);
                } else {
                    showInternalMenu(link, url, event);
                }

                return false;
            }, true);

            document.addEventListener('submit', function(event) {
                event.preventDefault();
                console.log('Form submission prevented in preview');
                return false;
            }, true);

            document.addEventListener('mousedown', function(event) {
                const menu = document.getElementById(MENU_ID);
                if (!menu) return;
                if (menu.contains(event.target) || activeLink?.contains(event.target)) return;
                removeMenu();
            });

            document.addEventListener('keydown', function(event) {
                if (event.key === 'Escape') {
                    removeMenu();
                }
            });

            const style = document.createElement('style');
            style.textContent = `
                a { cursor: default !important; }
                a:hover { opacity: 0.8; }
                #${MENU_ID} {
                    position: absolute;
                    z-index: 2147483647;
                    min-width: 14rem;
                    max-width: 18rem;
                    border: 1px solid #e5e7eb;
                    border-radius: 0.375rem;
                    background: #fff;
                    padding: 0.25rem 0;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                }
                #${MENU_ID} button {
                    display: block;
                    width: 100%;
                    border: 0;
                    background: transparent;
                    padding: 0.5rem 0.75rem;
                    color: #374151;
                    font: inherit;
                    font-size: 0.875rem;
                    line-height: 1.25rem;
                    text-align: left;
                    cursor: pointer;
                }
                #${MENU_ID} button:hover:not(:disabled) {
                    background: #f3f4f6;
                }
                #${MENU_ID} button:disabled {
                    color: #9ca3af;
                    cursor: not-allowed;
                }
                .eceee-preview-nav-menu-loading {
                    padding: 0.5rem 0.75rem;
                    color: #6b7280;
                    font-size: 0.875rem;
                    line-height: 1.25rem;
                }
            `;
            document.head.appendChild(style);
        })();
"""


@api_view(["POST"])
@authentication_classes([JWTAuthentication, SessionAuthentication, TokenAuthentication])
@permission_classes([permissions.IsAuthenticated])
def create_version_preview_grant(request, page_id, version_id):
    """Issue a short-lived grant that cannot authorize anything except one preview."""
    page = get_object_or_404(WebPage.objects.select_related("tenant"), id=page_id)
    get_object_or_404(PageVersion, id=version_id, page=page)
    if not page.tenant.user_has_access(request.user):
        raise PermissionDenied("You do not have access to this page.")

    token = signing.dumps(
        {"user_id": request.user.pk, "page_id": page.pk, "version_id": version_id},
        salt=PREVIEW_GRANT_SALT,
        compress=True,
    )
    return Response({"preview_token": token, "expires_in": PREVIEW_GRANT_MAX_AGE_SECONDS})


@api_view(["POST"])
@authentication_classes([PreviewNavigationGrantAuthentication])
@permission_classes([permissions.IsAuthenticated])
def resolve_preview_navigation(request, page_id, version_id):
    """Resolve one same-site link and mint a grant scoped to its target preview."""
    source_page = get_object_or_404(WebPage.objects.select_related("tenant"), id=page_id, is_deleted=False)
    get_object_or_404(PageVersion, id=version_id, page=source_page)
    if not source_page.tenant.user_has_access(request.user):
        raise PermissionDenied("You do not have access to this page.")
    if str(request.auth.get("tenant_id")) != str(source_page.tenant_id):
        raise AuthenticationFailed("Preview navigation grant does not match this tenant.")

    if not isinstance(request.data, dict):
        return Response({"detail": "A JSON object is required."}, status=status.HTTP_400_BAD_REQUEST)

    raw_path = request.data.get("path")
    if not isinstance(raw_path, str) or len(raw_path) > 2048 or not raw_path.startswith("/"):
        return Response({"detail": "A valid absolute path is required."}, status=status.HTTP_400_BAD_REQUEST)

    normalized_path = f"/{raw_path.strip('/')}/" if raw_path.strip("/") else "/"
    candidates = WebPage.objects.filter(
        tenant=source_page.tenant,
        cached_path=normalized_path,
        is_deleted=False,
    ).select_related("latest_version", "current_published_version", "parent")

    hostname = request.data.get("hostname")
    target_page = None
    if isinstance(hostname, str) and hostname:
        target_page = next(
            (candidate for candidate in candidates if candidate.get_root_page().serves_hostname(hostname)), None
        )
    if target_page is None:
        source_root_id = source_page.get_root_page().id
        target_page = next(
            (candidate for candidate in candidates if candidate.get_root_page().id == source_root_id), None
        )

    if target_page is None:
        return Response({"pageId": None, "isPublished": False, "latestVersionId": None, "previewUrl": ""})

    published_version = target_page.get_current_published_version()
    target_version = target_page.get_latest_version() if request.user.is_staff else published_version
    preview_url = ""
    if target_version:
        target_token = signing.dumps(
            {"user_id": request.user.pk, "page_id": target_page.pk, "version_id": target_version.pk},
            salt=PREVIEW_GRANT_SALT,
            compress=True,
        )
        preview_url = reverse(
            "api:page-version-preview",
            kwargs={"page_id": target_page.pk, "version_id": target_version.pk},
        )
        preview_url = f"{preview_url}?standalone=1&preview_token={target_token}"

    return Response(
        {
            "pageId": target_page.pk,
            "isPublished": published_version is not None,
            "latestVersionId": target_version.pk if target_version else None,
            "previewUrl": preview_url,
        }
    )


@api_view(["GET"])
@authentication_classes(
    [
        PreviewGrantAuthentication,
        JWTAuthentication,
        SessionAuthentication,
        TokenAuthentication,
    ]
)
@permission_classes([permissions.IsAuthenticated])
@xframe_options_exempt
def render_version_preview(request, page_id, version_id):
    """
    Render a specific page version for preview in the page editor.

    This endpoint renders the complete HTML for a page version, suitable
    for display in an iframe. Only authenticated users with page editing
    permissions can access this endpoint.

    Authentication can be provided via a standard authenticated request or a
    short-lived, page/version-scoped preview grant.

    Args:
        request: HTTP request
        page_id: ID of the WebPage
        version_id: ID of the PageVersion to render

    Returns:
        HttpResponse with complete HTML page including CSS and meta tags
    """

    if not request.user.is_authenticated:
        return HttpResponse(
            "<html><body><h1>Unauthorized</h1><p>You must be logged in to preview pages.</p></body></html>",
            status=401,
        )

    # Get the page and version
    page = get_object_or_404(WebPage, id=page_id)
    version = get_object_or_404(PageVersion, id=version_id, page=page)
    if not page.tenant.user_has_access(request.user):
        raise PermissionDenied("You do not have access to this page.")

    # Get the root page to access hostnames
    root_page = page
    while root_page.parent:
        root_page = root_page.parent

    # Check if root page has hostnames configured.
    # The hostname is only used to build the <base href> and asset URLs for
    # the preview iframe. When the root page has no explicit hostnames we
    # fall back to the current request's host, which is always a valid
    # origin for serving the page's assets (the editor itself is being
    # served from it). This avoids surfacing a misleading "configuration
    # required" page in production for sub-pages whose root page simply
    # has no hostnames configured yet.
    hostname = None
    if not root_page.hostnames or len(root_page.hostnames) == 0:
        hostname = request.get_host()
        # Determine protocol: respect the proxied scheme when available so
        # production previews behind a reverse proxy still use https.
        forwarded_proto = request.META.get("HTTP_X_FORWARDED_PROTO")
        if forwarded_proto:
            protocol = forwarded_proto.split(",")[0].strip()
        elif request.is_secure():
            protocol = "https"
        elif hostname.startswith("localhost") or hostname.startswith("127.0.0.1"):
            protocol = "http"
        else:
            protocol = "https"
        base_url = f"{protocol}://{hostname}/"
    else:
        # Get the first hostname from the root page
        hostname = root_page.hostnames[0]

        # Determine protocol (use http for localhost, https for others)
        if hostname.startswith("localhost") or hostname.startswith("127.0.0.1"):
            protocol = "http"
        else:
            protocol = "https"

        # In development mode, if the hostname doesn't have a port,
        # use the port from the current request to ensure assets load correctly.
        if settings.DEBUG and ":" not in hostname:
            request_host = request.get_host()
            if ":" in request_host:
                port = request_host.split(":")[-1]
                hostname = f"{hostname}:{port}"

        # Build base URL
        base_url = f"{protocol}://{hostname}/"

    try:
        preview_overflow = "auto" if request.query_params.get("standalone") == "1" else "hidden"

        navigation_grant = signing.dumps(
            {
                "user_id": request.user.pk,
                "tenant_id": str(page.tenant_id),
                "page_id": page.pk,
                "version_id": version.pk,
            },
            salt=PREVIEW_NAVIGATION_GRANT_SALT,
            compress=True,
        )
        navigation_context = json.dumps(
            {
                "endpoint": reverse(
                    "api:page-version-preview-navigation",
                    kwargs={"page_id": page.pk, "version_id": version.pk},
                ),
                "grant": navigation_grant,
            }
        ).replace("<", "\\u003c")

        # Use the WebPageRenderer to render the complete page
        renderer = WebPageRenderer(request=request)
        result = renderer.render(page, version=version)

        # Read lightbox CSS to include in preview (since it's normally loaded via <link> tag)
        lightbox_css = ""
        lightbox_css_path = os.path.join(settings.BASE_DIR, "static", "css", "lightbox.css")
        try:
            with open(lightbox_css_path, "r") as f:
                lightbox_css = f.read()
        except FileNotFoundError:
            pass  # Lightbox CSS not found, continue without it

        # Build complete HTML document with base tag for proper URL resolution
        # and JavaScript to keep preview links inside the editor workflow.
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="referrer" content="no-referrer">
    <base href="{base_url}">
    {result.get('meta', '')}

    <!-- Tailwind CSS - required for responsive utilities like useContentMargins -->
    <link href="{base_url}static/css/tailwind.output.css" rel="stylesheet">

    <style>
        /* Lightbox CSS */
        {lightbox_css}

        /* Page CSS */
        {result.get('css', '')}

        /* The editor owns iframe scrolling; standalone history previews own their scrolling. */
        html, body {{
            overflow: {preview_overflow} !important;
        }}
    </style>
    <script>
        window.eceeePreviewNavigation = {navigation_context};
{PREVIEW_NAVIGATION_MENU_SCRIPT}
    </script>
</head>
<body>
    {result.get('html', '')}
</body>
</html>
"""

        response = HttpResponse(html_content, content_type="text/html")
        response["Cache-Control"] = "private, no-store"
        response["Referrer-Policy"] = "no-referrer"
        return response

    except Exception as e:
        # Return error page if rendering fails
        error_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview Error</title>
    <style>
        body {{
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        .error-box {{
            background: white;
            border: 1px solid #e5e5e5;
            border-left: 4px solid #dc2626;
            padding: 20px;
            border-radius: 4px;
        }}
        h1 {{
            margin-top: 0;
            color: #dc2626;
        }}
        pre {{
            background: #f9f9f9;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
        }}
    </style>
</head>
<body>
    <div class="error-box">
        <h1>Preview Rendering Error</h1>
        <p>Failed to render page preview for version {version.version_number}.</p>
        {'<pre>' + str(e) + '</pre>' if settings.DEBUG else ''}
        <p><small>Page ID: {page_id} | Version ID: {version_id}</small></p>
    </div>
</body>
</html>
"""
        return HttpResponse(error_html, content_type="text/html", status=500)
