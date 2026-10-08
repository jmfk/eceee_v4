from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from webpages.views.code_layout_views import CodeLayoutViewSet


class CodeLayoutViewTests(SimpleTestCase):
    def test_code_layout_api_collapses_status_layouts_into_one_error_layout(self):
        request = APIRequestFactory().get("/api/v1/webpages/layouts/", {"source": "code"})

        response = CodeLayoutViewSet.as_view({"get": "list"})(request)
        names = [item["name"] for item in response.data["results"]]

        self.assertEqual(names.count("error_layout"), 1)
        self.assertFalse({"error_403", "error_404", "error_500", "error_503"} & set(names))
