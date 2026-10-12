from types import SimpleNamespace

from django.test import RequestFactory, SimpleTestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate

from webpages.public_views import HostnamePageView, custom_404_handler
from webpages.views.preview_views import create_version_preview_grant, render_version_preview
from webpages.views.rendering_views import render_page_backend, render_page_preview


@override_settings(
    DJANGO_PUBLIC_RENDERER_ENABLED=False,
    DJANGO_LEGACY_RENDER_API_ENABLED=False,
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
)
class RenderingDeprecationTests(SimpleTestCase):
    def setUp(self):
        self.user = SimpleNamespace(is_authenticated=True, pk=1)
        self.api_factory = APIRequestFactory()

    def _authenticated(self, request):
        force_authenticate(request, user=self.user)
        return request

    def test_public_django_renderer_is_blocked_before_page_lookup(self):
        request = RequestFactory().get("/conference/programme/")

        with self.assertLogs("webpages.rendering_deprecation", level="WARNING"):
            response = HostnamePageView.as_view()(request, slug_path="conference/programme")

        self.assertEqual(response.status_code, 410)
        self.assertEqual(response["X-ECEEE-Renderer"], "django-disabled")
        self.assertEqual(response["Cache-Control"], "no-store")

    def test_custom_error_pages_do_not_reenter_the_public_renderer(self):
        request = RequestFactory().get("/missing/")

        response = custom_404_handler(request)

        self.assertEqual(response.status_code, 404)
        self.assertNotIn("X-ECEEE-Renderer", response)

    def test_legacy_render_endpoints_are_blocked_before_database_access(self):
        requests_and_views = [
            (
                self._authenticated(self.api_factory.get("/api/v1/webpages/pages/1/render/")),
                lambda request: render_page_backend(request, page_id=1),
            ),
            (
                self._authenticated(self.api_factory.post("/api/v1/webpages/pages/preview/", {}, format="json")),
                render_page_preview,
            ),
            (
                self._authenticated(self.api_factory.get("/api/v1/webpages/pages/1/versions/2/preview/")),
                lambda request: render_version_preview(request, page_id=1, version_id=2),
            ),
            (
                self._authenticated(self.api_factory.post("/api/v1/webpages/pages/1/versions/2/preview-grant/")),
                lambda request: create_version_preview_grant(request, page_id=1, version_id=2),
            ),
        ]

        for request, view in requests_and_views:
            with self.subTest(path=request.path):
                with self.assertLogs("webpages.rendering_deprecation", level="WARNING"):
                    response = view(request)
                self.assertEqual(response.status_code, 410)
                self.assertEqual(response["X-ECEEE-Renderer"], "django-disabled")
                self.assertEqual(response.data, {"detail": "The legacy Django rendering API is disabled."})
